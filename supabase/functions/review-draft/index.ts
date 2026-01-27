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

    const { initData, dealId, action, revisionComment } = await req.json();

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
    console.log(`[review-draft] User ${telegramId} reviewing deal ${dealId}, action: ${action}`);

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
      .select("id, status, advertiser_id, channel_id, revision_count, author_draft")
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
      .select("owner_id, title, username")
      .eq("id", deal.channel_id)
      .single();

    // Verify user is advertiser
    if (deal.advertiser_id !== user.id) {
      return new Response(
        JSON.stringify({ success: false, error: "Только рекламодатель может проверять черновик" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify deal status
    if (deal.status !== "escrow") {
      return new Response(
        JSON.stringify({ success: false, error: "Сделка не в статусе проверки" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify draft exists
    if (!deal.author_draft) {
      return new Response(
        JSON.stringify({ success: false, error: "Черновик еще не отправлен" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get channel owner for notification
    const { data: channelOwner } = await supabase
      .from("users")
      .select("telegram_id")
      .eq("id", channel?.owner_id)
      .single();

    const channelTitle = channel?.title || channel?.username || "канала";

    if (action === "approve") {
      // Approve draft - move to in_progress
      const { error: updateError } = await supabase
        .from("deals")
        .update({
          is_draft_approved: true,
          status: "in_progress",
        })
        .eq("id", dealId);

      if (updateError) throw updateError;

      // Notify channel owner
      if (channelOwner?.telegram_id) {
        const message = `✅ <b>Черновик одобрен!</b>

Рекламодатель одобрил ваш пост для канала ${channelTitle}.

Публикация будет выполнена автоматически по расписанию.`;

        try {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: channelOwner.telegram_id,
              text: message,
              parse_mode: "HTML",
            }),
          });
        } catch (e) {
          console.error("Failed to notify owner:", e);
        }
      }

      console.log(`[review-draft] Draft approved for deal ${dealId}`);
    } else if (action === "request_revision") {
      // Request revision
      const { error: updateError } = await supabase
        .from("deals")
        .update({
          is_draft_approved: false,
          revision_count: (deal.revision_count || 0) + 1,
        })
        .eq("id", dealId);

      if (updateError) throw updateError;

      // Notify channel owner
      if (channelOwner?.telegram_id) {
        const message = `✏️ <b>Требуется доработка</b>

Рекламодатель просит внести изменения в черновик для канала ${channelTitle}.

${revisionComment ? `<b>Комментарий:</b>\n${revisionComment}` : ""}

Отредактируйте пост в приложении Adsingo.`;

        try {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: channelOwner.telegram_id,
              text: message,
              parse_mode: "HTML",
            }),
          });
        } catch (e) {
          console.error("Failed to notify owner:", e);
        }
      }

      console.log(`[review-draft] Revision requested for deal ${dealId}`);
    } else {
      return new Response(
        JSON.stringify({ success: false, error: "Неверное действие" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("review-draft error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Ошибка сервера" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
