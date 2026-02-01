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

async function validateTelegramData(initData: string, botToken: string): Promise<{ valid: boolean; data?: ParsedInitData }> {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");
    if (!hash) return { valid: false };

    urlParams.delete("hash");
    const dataCheckString = Array.from(urlParams.entries())
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join("\n");

    const encoder = new TextEncoder();
    const keyData = encoder.encode("WebAppData");
    const tokenData = encoder.encode(botToken);
    
    const hmacKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const secretKeyBuffer = await crypto.subtle.sign("HMAC", hmacKey, tokenData);
    const secretKey = await crypto.subtle.importKey("raw", secretKeyBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const dataBuffer = encoder.encode(dataCheckString);
    const hashBuffer = await crypto.subtle.sign("HMAC", secretKey, dataBuffer);
    
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const calculatedHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    if (calculatedHash !== hash) return { valid: false };

    const userString = urlParams.get("user");
    const authDate = parseInt(urlParams.get("auth_date") || "0", 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) return { valid: false };

    let user: TelegramUser | undefined;
    if (userString) user = JSON.parse(userString);

    return { valid: true, data: { user, auth_date: authDate } };
  } catch {
    return { valid: false };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { initData, dealId, draftText, draftMediaUrls } = await req.json();

    // Validate initData
    if (!initData) {
      return new Response(
        JSON.stringify({ success: false, error: "Нет данных авторизации" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validation = await validateTelegramData(initData, botToken);
    if (!validation.valid || !validation.data?.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Неверная авторизация" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const telegramId = validation.data.user.id;
    console.log(`[submit-draft] User ${telegramId} submitting draft for deal ${dealId}`);

    // Get user from DB
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: "Пользователь не найден" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get deal
    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select("id, status, advertiser_id, channel_id, campaign_id")
      .eq("id", dealId)
      .single();

    if (dealError || !deal) {
      return new Response(
        JSON.stringify({ success: false, error: "Сделка не найдена" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get channel info
    const { data: channel } = await supabase
      .from("channels")
      .select("id, owner_id, title, username")
      .eq("id", deal.channel_id)
      .single();

    // Get campaign info
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("campaign_type")
      .eq("id", deal.campaign_id)
      .single();

    // Verify user is channel owner or admin
    const isOwner = channel?.owner_id === user.id;
    
    const { data: adminRecord } = await supabase
      .from("channel_admins")
      .select("id")
      .eq("channel_id", deal.channel_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!isOwner && !adminRecord) {
      return new Response(
        JSON.stringify({ success: false, error: "Нет доступа к этому каналу" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify deal status
    if (deal.status !== "escrow") {
      return new Response(
        JSON.stringify({ success: false, error: "Сделка не в статусе ожидания черновика" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify campaign type
    if (campaign?.campaign_type !== "prompt") {
      return new Response(
        JSON.stringify({ success: false, error: "Эта кампания не требует написания поста" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update deal with draft
    const { error: updateError } = await supabase
      .from("deals")
      .update({
        author_draft: draftText,
        author_draft_media_urls: draftMediaUrls || [],
        is_draft_approved: null, // Waiting for review
        draft_submitted_at: new Date().toISOString(), // Track submission time for 24h timeout
      })
      .eq("id", dealId);

    if (updateError) {
      throw updateError;
    }

    // Notify advertiser
    const { data: advertiser } = await supabase
      .from("users")
      .select("telegram_id")
      .eq("id", deal.advertiser_id)
      .single();

    if (advertiser?.telegram_id) {
      const channelTitle = channel?.title || channel?.username || "канала";
      const message = `📝 <b>Черновик готов к проверке</b>

Автор канала ${channelTitle} написал пост по вашему брифу.

⏰ <b>Важно:</b> У вас есть 24 часа на проверку. После этого сделка будет автоматически закрыта (70% вернётся вам, 30% получит автор за проделанную работу).

Проверьте и одобрите в приложении Adsingo.`;

      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: advertiser.telegram_id,
            text: message,
            parse_mode: "HTML",
          }),
        });
      } catch (e) {
        console.error("Failed to notify advertiser:", e);
      }
    }

    console.log(`[submit-draft] Draft submitted for deal ${dealId}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("submit-draft error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Ошибка сервера" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
