import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface ParsedInitData {
  user?: TelegramUser;
  auth_date: number;
}

// Validate Telegram initData using HMAC-SHA256
async function validateTelegramData(initData: string, botToken: string): Promise<{ valid: boolean; data?: ParsedInitData }> {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");
    
    if (!hash) {
      return { valid: false };
    }

    urlParams.delete("hash");
    const dataCheckString = Array.from(urlParams.entries())
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join("\n");

    const encoder = new TextEncoder();
    const keyData = encoder.encode("WebAppData");
    const tokenData = encoder.encode(botToken);
    
    const hmacKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const secretKeyBuffer = await crypto.subtle.sign("HMAC", hmacKey, tokenData);
    
    const secretKey = await crypto.subtle.importKey(
      "raw",
      secretKeyBuffer,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const dataBuffer = encoder.encode(dataCheckString);
    const hashBuffer = await crypto.subtle.sign("HMAC", secretKey, dataBuffer);
    
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const calculatedHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    if (calculatedHash !== hash) {
      return { valid: false };
    }

    const userString = urlParams.get("user");
    const authDate = parseInt(urlParams.get("auth_date") || "0", 10);
    
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) {
      return { valid: false };
    }

    let user: TelegramUser | undefined;
    if (userString) {
      user = JSON.parse(userString);
    }

    return {
      valid: true,
      data: { user, auth_date: authDate },
    };
  } catch (error) {
    console.error("Validation error:", error);
    return { valid: false };
  }
}

interface DeleteCampaignRequest {
  campaign_id: string;
  initData: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      throw new Error("TELEGRAM_BOT_TOKEN not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: DeleteCampaignRequest = await req.json();
    const { campaign_id, initData } = body;

    // 1. VALIDATE INITDATA (critical for security!)
    if (!initData) {
      return new Response(
        JSON.stringify({ success: false, error: "Не предоставлены данные авторизации" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validation = await validateTelegramData(initData, botToken);
    if (!validation.valid || !validation.data?.user) {
      console.log("[delete-campaign] Invalid Telegram data");
      return new Response(
        JSON.stringify({ success: false, error: "Неверные данные авторизации Telegram" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const telegramId = validation.data.user.id;
    console.log(`[delete-campaign] Validated user: ${telegramId}`);

    if (!campaign_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Не указан ID кампании" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Find user by VERIFIED telegram_id
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ success: false, error: "Пользователь не найден" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Verify campaign belongs to VERIFIED user
    const { data: campaign, error: fetchError } = await supabase
      .from("campaigns")
      .select("id, owner_id")
      .eq("id", campaign_id)
      .maybeSingle();

    if (fetchError) {
      console.error("Fetch error:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: "Ошибка при проверке кампании" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!campaign) {
      return new Response(
        JSON.stringify({ success: false, error: "Кампания не найдена" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check ownership with VERIFIED user.id
    if (campaign.owner_id !== userData.id) {
      return new Response(
        JSON.stringify({ success: false, error: "Нет прав на удаление этой кампании" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Check for active deals before deletion
    const { count: activeDeals, error: countError } = await supabase
      .from("deals")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaign_id)
      .in("status", ["pending", "escrow", "in_progress"]);

    if (countError) {
      console.error("Count deals error:", countError);
      return new Response(
        JSON.stringify({ success: false, error: "Ошибка проверки сделок" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (activeDeals && activeDeals > 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Нельзя удалить кампанию с активными сделками" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Delete campaign
    const { error: deleteError } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", campaign_id);

    if (deleteError) {
      console.error("Delete error:", deleteError);
      return new Response(
        JSON.stringify({ success: false, error: "Ошибка удаления кампании" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[delete-campaign] Campaign ${campaign_id} deleted by user ${userData.id}`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Delete campaign error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Внутренняя ошибка сервера" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
