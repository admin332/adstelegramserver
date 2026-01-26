import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Validate Telegram initData
function validateTelegramData(initData: string, botToken: string): { valid: boolean; user?: any } {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");
    if (!hash) return { valid: false };

    urlParams.delete("hash");
    const dataCheckArr: string[] = [];
    urlParams.sort();
    urlParams.forEach((value, key) => {
      dataCheckArr.push(`${key}=${value}`);
    });
    const dataCheckString = dataCheckArr.join("\n");

    const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
    const calculatedHash = createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (calculatedHash !== hash) return { valid: false };

    const userStr = urlParams.get("user");
    if (!userStr) return { valid: false };

    return { valid: true, user: JSON.parse(userStr) };
  } catch {
    return { valid: false };
  }
}

// Format date in Moscow timezone
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "По согласованию";
  
  const date = new Date(dateStr);
  const formatter = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(date);
  const day = parts.find(p => p.type === 'day')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const year = parts.find(p => p.type === 'year')?.value;
  const hour = parts.find(p => p.type === 'hour')?.value;
  const minute = parts.find(p => p.type === 'minute')?.value;
  
  return `${day}.${month}.${year} в ${hour}:${minute}`;
}

async function sendTelegramMessage(botToken: string, chatId: number, text: string) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  });
  return response.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { initData, dealId, action } = await req.json();

    if (!initData || !dealId || !action) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["approve", "reject", "request_changes"].includes(action)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      return new Response(
        JSON.stringify({ success: false, error: "Bot token not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { valid, user: telegramUser } = validateTelegramData(initData, botToken);
    if (!valid || !telegramUser) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid initData" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find user by telegram_id
    const { data: dbUser, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", telegramUser.id)
      .maybeSingle();

    if (userError || !dbUser) {
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = dbUser.id;

    // Fetch deal with channel info
    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select(`
        id,
        status,
        channel_id,
        advertiser_id,
        scheduled_at,
        total_price,
        posts_count,
        duration_hours,
        channel:channels(id, title, username)
      `)
      .eq("id", dealId)
      .maybeSingle();

    if (dealError || !deal) {
      return new Response(
        JSON.stringify({ success: false, error: "Deal not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user is channel admin/owner
    const { data: channelAdmin } = await supabase
      .from("channel_admins")
      .select("id")
      .eq("channel_id", deal.channel_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!channelAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: "Not authorized for this channel" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only allow actions on escrow status deals
    if (deal.status !== "escrow") {
      return new Response(
        JSON.stringify({ success: false, error: "Deal is not in escrow status" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get advertiser info for notification
    const { data: advertiser } = await supabase
      .from("users")
      .select("telegram_id, first_name")
      .eq("id", deal.advertiser_id)
      .maybeSingle();

    const channelData = Array.isArray(deal.channel) ? deal.channel[0] : deal.channel;
    const channelTitle = channelData?.title || channelData?.username || "Канал";

    if (action === "approve") {
      // Update deal status to in_progress
      const { error: updateError } = await supabase
        .from("deals")
        .update({ status: "in_progress", updated_at: new Date().toISOString() })
        .eq("id", dealId);

      if (updateError) {
        console.error("Error updating deal:", updateError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to update deal" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Notify advertiser
      if (advertiser?.telegram_id) {
        const scheduledText = deal.scheduled_at 
          ? `\n📅 Публикация: ${formatDate(deal.scheduled_at)}`
          : "";
        
        await sendTelegramMessage(
          botToken,
          advertiser.telegram_id,
          `✅ <b>Ваша реклама одобрена!</b>\n\n` +
          `Канал: ${channelTitle}${scheduledText}\n\n` +
          `Ожидайте размещения.`
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Deal approved" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "reject") {
      // Update deal status to cancelled
      const { error: updateError } = await supabase
        .from("deals")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", dealId);

      if (updateError) {
        console.error("Error updating deal:", updateError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to update deal" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Notify advertiser
      if (advertiser?.telegram_id) {
        await sendTelegramMessage(
          botToken,
          advertiser.telegram_id,
          `❌ <b>Реклама отклонена</b>\n\n` +
          `Канал: ${channelTitle}\n\n` +
          `Средства будут возвращены на ваш кошелёк.`
        );
      }

      // TODO: Initiate refund process

      return new Response(
        JSON.stringify({ success: true, message: "Deal rejected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "request_changes") {
      // Send notification to advertiser with deep link to bot
      if (advertiser?.telegram_id) {
        await sendTelegramMessage(
          botToken,
          advertiser.telegram_id,
          `✏️ <b>Владелец канала предлагает изменения</b>\n\n` +
          `Канал: ${channelTitle}\n\n` +
          `Откройте чат с @adsingo_bot для обсуждения деталей.`
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Change request sent" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in deal-action:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
