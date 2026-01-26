import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Deal {
  id: string;
  total_price: number;
  posts_count: number;
  duration_hours: number;
  scheduled_at: string | null;
  campaign: {
    text: string;
    media_urls: string[] | null;
    button_text: string | null;
    button_url: string | null;
  } | null;
  channel: {
    id: string;
    title: string;
    owner: {
      telegram_id: number;
    };
  };
}

// Send Telegram request helper
async function sendTelegramRequest(method: string, body: Record<string, unknown>) {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set");
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const result = await response.json();
  console.log(`Telegram ${method} response:`, result);
  
  if (!result.ok) {
    console.error(`Telegram API error: ${result.description}`);
  }
  
  return result;
}

// Check if URL is a video
function isVideoUrl(url: string): boolean {
  const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowerUrl.includes(ext));
}

// Send campaign preview to owner
async function sendCampaignPreview(telegramId: number, campaign: Deal['campaign']) {
  if (!campaign) return;
  
  const { text, media_urls, button_text, button_url } = campaign;
  
  const replyMarkup = button_text && button_url ? {
    inline_keyboard: [[{ text: button_text, url: button_url }]],
  } : undefined;

  // Case 1: No media - send text message
  if (!media_urls || media_urls.length === 0) {
    await sendTelegramRequest("sendMessage", {
      chat_id: telegramId,
      text: text,
      parse_mode: "HTML",
      ...(replyMarkup && { reply_markup: replyMarkup }),
    });
  }
  // Case 2: Single media file
  else if (media_urls.length === 1) {
    const mediaUrl = media_urls[0];
    const isVideo = isVideoUrl(mediaUrl);

    if (isVideo) {
      await sendTelegramRequest("sendVideo", {
        chat_id: telegramId,
        video: mediaUrl,
        caption: text,
        parse_mode: "HTML",
        ...(replyMarkup && { reply_markup: replyMarkup }),
      });
    } else {
      await sendTelegramRequest("sendPhoto", {
        chat_id: telegramId,
        photo: mediaUrl,
        caption: text,
        parse_mode: "HTML",
        ...(replyMarkup && { reply_markup: replyMarkup }),
      });
    }
  }
  // Case 3: Multiple media files (2-10) - use media group
  else {
    const mediaGroup = media_urls.map((url, index) => {
      const isVideo = isVideoUrl(url);
      return {
        type: isVideo ? "video" : "photo",
        media: url,
        ...(index === 0 && { caption: text, parse_mode: "HTML" }),
      };
    });

    await sendTelegramRequest("sendMediaGroup", {
      chat_id: telegramId,
      media: mediaGroup,
    });

    // Send button as separate message after media group (if button exists)
    if (replyMarkup) {
      await sendTelegramRequest("sendMessage", {
        chat_id: telegramId,
        text: "👆 Рекламный пост выше",
        reply_markup: replyMarkup,
      });
    }
  }
}

// Get Russian plural form for "пост"
function getPostsWord(count: number): string {
  const lastTwo = count % 100;
  const lastOne = count % 10;
  
  if (lastTwo >= 11 && lastTwo <= 19) return "постов";
  if (lastOne === 1) return "пост";
  if (lastOne >= 2 && lastOne <= 4) return "поста";
  return "постов";
}

// Get Russian plural form for "час"
function getHoursWord(count: number): string {
  const lastTwo = count % 100;
  const lastOne = count % 10;
  
  if (lastTwo >= 11 && lastTwo <= 19) return "часов";
  if (lastOne === 1) return "час";
  if (lastOne >= 2 && lastOne <= 4) return "часа";
  return "часов";
}

// Format date in Russian
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "По согласованию";
  
  const date = new Date(dateStr);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${day}.${month}.${year} в ${hours}:${minutes}`;
}

// Send payment notification with approve/reject buttons
async function sendPaymentNotification(deal: Deal) {
  const ownerTelegramId = deal.channel.owner.telegram_id;
  
  if (!ownerTelegramId) {
    console.error(`No telegram_id found for channel owner of channel ${deal.channel.id}`);
    return;
  }

  const formattedDate = formatDate(deal.scheduled_at);
  const postsWord = getPostsWord(deal.posts_count);
  const hoursWord = getHoursWord(deal.duration_hours);
  
  const notificationText = `✅ <b>Реклама оплачена!</b>

Рекламодатель оплатил <b>${deal.posts_count} ${postsWord}</b> на <b>${deal.duration_hours} ${hoursWord}</b>

📅 Начало: <b>${formattedDate}</b>

💰 Вы получите: <b>${deal.total_price} TON</b>

Проверьте материалы выше и нажмите «Одобрить» для публикации или откройте бот и предложите изменения.`;

  await sendTelegramRequest("sendMessage", {
    chat_id: ownerTelegramId,
    text: notificationText,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Одобрить", callback_data: `approve_deal:${deal.id}` },
          { text: "❌ Отклонить", callback_data: `reject_deal:${deal.id}` }
        ]
      ]
    }
  });
  
  console.log(`Sent payment notification for deal ${deal.id} to user ${ownerTelegramId}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dealId } = await req.json();

    if (!dealId) {
      return new Response(
        JSON.stringify({ error: "dealId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Sending payment notification for deal:", dealId);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch deal with all necessary data
    const { data: deal, error: fetchError } = await supabase
      .from('deals')
      .select(`
        id,
        total_price,
        posts_count,
        duration_hours,
        scheduled_at,
        campaign:campaigns(text, media_urls, button_text, button_url),
        channel:channels(
          id,
          title,
          owner:users!channels_owner_id_fkey(telegram_id)
        )
      `)
      .eq('id', dealId)
      .single();

    if (fetchError) {
      console.error("Error fetching deal:", fetchError);
      throw fetchError;
    }

    if (!deal) {
      return new Response(
        JSON.stringify({ error: "Deal not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const typedDeal = deal as unknown as Deal;
    const ownerTelegramId = typedDeal.channel?.owner?.telegram_id;

    if (!ownerTelegramId) {
      return new Response(
        JSON.stringify({ error: "Channel owner telegram_id not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Send campaign preview
    await sendCampaignPreview(ownerTelegramId, typedDeal.campaign);
    
    // Small delay to ensure messages arrive in order
    await new Promise(resolve => setTimeout(resolve, 500));

    // 2. Send payment notification with buttons
    await sendPaymentNotification(typedDeal);

    return new Response(
      JSON.stringify({ success: true, message: "Notification sent successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in notify-deal-payment:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
