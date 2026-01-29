import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Deal {
  id: string;
  escrow_address: string;
  total_price: number;
  posts_count: number;
  duration_hours: number;
  scheduled_at: string | null;
  advertiser_id: string;
  campaign: {
    text: string;
    media_urls: string[] | null;
    button_text: string | null;
    button_url: string | null;
    campaign_type: string;
  } | null;
  channel: {
    id: string;
    title: string;
    username: string;
    telegram_chat_id: number;
    owner_id: string;
    owner: {
      telegram_id: number;
    };
  };
  advertiser: {
    telegram_id: number;
  };
}

// Check escrow balance via TonCenter API
async function checkEscrowBalance(address: string): Promise<number> {
  const apiKey = Deno.env.get("TONCENTER_API_KEY");
  const baseUrl = "https://toncenter.com/api/v2";
  
  const url = apiKey 
    ? `${baseUrl}/getAddressBalance?address=${address}&api_key=${apiKey}`
    : `${baseUrl}/getAddressBalance?address=${address}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.ok && data.result) {
      return parseInt(data.result, 10); // Balance in nanoTON
    }
    
    console.log(`Failed to get balance for ${address}:`, data);
    return 0;
  } catch (error) {
    console.error(`Error checking balance for ${address}:`, error);
    return 0;
  }
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

// Send campaign preview to telegram user
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
        // Only first item gets the caption
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

// Format date in Moscow timezone (UTC+3)
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "По согласованию";
  
  const date = new Date(dateStr);
  
  // Format in Moscow timezone
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
  
  return `${day}.${month}.${year} в ${hour}:${minute} (МСК)`;
}

// Send payment notification to CHANNEL OWNER with approve/reject buttons
async function sendOwnerNotification(deal: Deal) {
  const ownerTelegramId = deal.channel.owner.telegram_id;
  
  if (!ownerTelegramId) {
    console.error(`No telegram_id found for channel owner of channel ${deal.channel.id}`);
    return;
  }

  const isPromptCampaign = deal.campaign?.campaign_type === "prompt";

  // For ready_post campaigns: send preview first
  if (!isPromptCampaign) {
    await sendCampaignPreview(ownerTelegramId, deal.campaign);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  const formattedDate = formatDate(deal.scheduled_at);
  const postsWord = getPostsWord(deal.posts_count);
  const hoursWord = getHoursWord(deal.duration_hours);
  
  let notificationText: string;
  
  if (isPromptCampaign) {
    // Prompt campaign: owner needs to write the post
    notificationText = `✅ <b>Реклама оплачена!</b>

📢 Канал: <b>${deal.channel.title || deal.channel.username}</b>

Рекламодатель оплатил <b>${deal.posts_count} ${postsWord}</b> на <b>${deal.duration_hours} ${hoursWord}</b>

📅 Публикация: <b>${formattedDate}</b>

💰 Вы получите: <b>${deal.total_price} TON</b>

📝 <b>Это заказ по брифу</b> — вам нужно написать пост самостоятельно.

Отправьте мне текст поста (можно с фото/видео), и я перешлю его рекламодателю на проверку.`;

    await sendTelegramRequest("sendMessage", {
      chat_id: ownerTelegramId,
      text: notificationText,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "❌ Отклонить заказ", callback_data: `reject_deal:${deal.id}` }]
        ]
      }
    });

    // Send brief as separate message
    await new Promise(resolve => setTimeout(resolve, 300));
    
    let briefText = `📋 <b>Бриф от рекламодателя:</b>

${deal.campaign?.text || "Бриф не указан"}`;

    // Для prompt кампаний - показываем ссылку на товар (Product Link)
    if (deal.campaign?.button_url) {
      if (deal.campaign?.button_text) {
        // Есть и текст кнопки и ссылка (ready_post)
        briefText += `\n\n🔗 Кнопка: <b>${deal.campaign.button_text}</b>\nСсылка: ${deal.campaign.button_url}`;
      } else {
        // Только ссылка (prompt кампания - Product Link)
        briefText += `\n\n🔗 <b>Ссылка на товар:</b> ${deal.campaign.button_url}`;
      }
    }

    await sendTelegramRequest("sendMessage", {
      chat_id: ownerTelegramId,
      text: briefText,
      parse_mode: "HTML",
    });

  } else {
    // Ready post campaign: standard flow
    notificationText = `✅ <b>Реклама оплачена!</b>

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
  }
  
  console.log(`Sent owner notification for deal ${deal.id} to user ${ownerTelegramId}`);
}

// Send payment confirmation to ADVERTISER
async function sendAdvertiserConfirmation(deal: Deal) {
  const advertiserTelegramId = deal.advertiser.telegram_id;
  
  if (!advertiserTelegramId) {
    console.error(`No telegram_id found for advertiser of deal ${deal.id}`);
    return;
  }

  const isPromptCampaign = deal.campaign?.campaign_type === "prompt";
  const formattedDate = formatDate(deal.scheduled_at);
  const postsWord = getPostsWord(deal.posts_count);
  const hoursWord = getHoursWord(deal.duration_hours);
  const channelName = deal.channel.title || `@${deal.channel.username}`;

  let notificationText: string;

  if (isPromptCampaign) {
    // Prompt campaign: advertiser will receive draft for review
    notificationText = `💳 <b>Оплата прошла успешно!</b>

📢 Канал: <b>${channelName}</b>
📦 Заказ: <b>${deal.posts_count} ${postsWord}</b> на <b>${deal.duration_hours} ${hoursWord}</b>
📅 Публикация: <b>${formattedDate}</b>
💰 Сумма: <b>${deal.total_price} TON</b>

📝 <b>Тип кампании:</b> По брифу

Автор канала напишет пост по вашему брифу и пришлёт на проверку. Вы сможете одобрить или попросить доработку.`;

    await sendTelegramRequest("sendMessage", {
      chat_id: advertiserTelegramId,
      text: notificationText,
      parse_mode: "HTML",
    });

    // Send brief reminder
    await new Promise(resolve => setTimeout(resolve, 300));
    
    let advertiserBriefText = `📋 <b>Ваш бриф:</b>

${deal.campaign?.text || "Бриф не указан"}`;

    // Для prompt кампаний - показываем ссылку на товар
    if (deal.campaign?.button_url) {
      if (deal.campaign?.button_text) {
        advertiserBriefText += `\n\n🔗 Кнопка: <b>${deal.campaign.button_text}</b>\nСсылка: ${deal.campaign.button_url}`;
      } else {
        advertiserBriefText += `\n\n🔗 <b>Ссылка на товар:</b> ${deal.campaign.button_url}`;
      }
    }

    await sendTelegramRequest("sendMessage", {
      chat_id: advertiserTelegramId,
      text: advertiserBriefText,
      parse_mode: "HTML",
    });

  } else {
    // Ready post: show preview and confirmation
    notificationText = `💳 <b>Оплата прошла успешно!</b>

📢 Канал: <b>${channelName}</b>
📦 Заказ: <b>${deal.posts_count} ${postsWord}</b> на <b>${deal.duration_hours} ${hoursWord}</b>
📅 Публикация: <b>${formattedDate}</b>
💰 Сумма: <b>${deal.total_price} TON</b>

Ожидаем подтверждения от владельца канала. Вы получите уведомление, когда пост будет опубликован.`;

    // Send preview first
    await sendCampaignPreview(advertiserTelegramId, deal.campaign);
    await new Promise(resolve => setTimeout(resolve, 500));

    await sendTelegramRequest("sendMessage", {
      chat_id: advertiserTelegramId,
      text: notificationText,
      parse_mode: "HTML",
    });
  }

  console.log(`Sent advertiser confirmation for deal ${deal.id} to user ${advertiserTelegramId}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Checking pending deals for escrow payments...");

    const now = new Date().toISOString();

    // 1. First, mark expired deals
    const { data: expiredDeals, error: expireError } = await supabase
      .from('deals')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('expires_at', now)
      .select('id');

    if (expireError) {
      console.error("Error marking expired deals:", expireError);
    } else if (expiredDeals && expiredDeals.length > 0) {
      console.log(`Marked ${expiredDeals.length} deals as expired`);
    }

    // 2. Get only active pending deals (not expired)
    const { data: pendingDeals, error: fetchError } = await supabase
      .from('deals')
      .select(`
        id,
        escrow_address,
        total_price,
        posts_count,
        duration_hours,
        scheduled_at,
        advertiser_id,
        campaign:campaigns(text, media_urls, button_text, button_url, campaign_type),
        channel:channels(
          id,
          title,
          username,
          telegram_chat_id,
          owner_id,
          owner:users!channels_owner_id_fkey(telegram_id)
        ),
        advertiser:users!deals_advertiser_id_fkey(telegram_id)
      `)
      .eq('status', 'pending')
      .gte('expires_at', now)
      .not('escrow_address', 'is', null);

    if (fetchError) {
      console.error("Error fetching pending deals:", fetchError);
      throw fetchError;
    }

    if (!pendingDeals || pendingDeals.length === 0) {
      console.log("No pending deals with escrow addresses found");
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No pending deals" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${pendingDeals.length} pending deals to check`);

    let processedCount = 0;
    const results: Array<{ dealId: string; status: string; balance?: number }> = [];

    // 2. Check each deal's escrow balance
    for (const deal of pendingDeals as unknown as Deal[]) {
      if (!deal.escrow_address) continue;
      
      console.log(`Checking balance for deal ${deal.id}, address: ${deal.escrow_address}`);
      
      const balanceNano = await checkEscrowBalance(deal.escrow_address);
      const balanceTon = balanceNano / 1_000_000_000;
      const requiredNano = deal.total_price * 1_000_000_000;
      
      console.log(`Deal ${deal.id}: balance=${balanceTon} TON, required=${deal.total_price} TON`);
      
      if (balanceNano >= requiredNano) {
        // 3. Update deal status to 'escrow'
        const { error: updateError } = await supabase
          .from('deals')
          .update({
            status: 'escrow',
            escrow_balance: balanceTon,
            payment_verified_at: new Date().toISOString()
          })
          .eq('id', deal.id);

        if (updateError) {
          console.error(`Error updating deal ${deal.id}:`, updateError);
          results.push({ dealId: deal.id, status: 'error' });
          continue;
        }

        console.log(`Deal ${deal.id} status updated to 'escrow'`);

        // 4. Send notification to CHANNEL OWNER
        try {
          await sendOwnerNotification(deal);
        } catch (notifyError) {
          console.error(`Error sending owner notification for deal ${deal.id}:`, notifyError);
        }

        // 5. Send confirmation to ADVERTISER
        try {
          await sendAdvertiserConfirmation(deal);
          results.push({ dealId: deal.id, status: 'success', balance: balanceTon });
          processedCount++;
        } catch (notifyError) {
          console.error(`Error sending advertiser confirmation for deal ${deal.id}:`, notifyError);
          results.push({ dealId: deal.id, status: 'owner_notified_only', balance: balanceTon });
          processedCount++;
        }
      } else {
        results.push({ dealId: deal.id, status: 'insufficient_balance', balance: balanceTon });
      }
      
      // Small delay between API calls to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`Processed ${processedCount} deals successfully`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: processedCount, 
        total: pendingDeals.length,
        results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in check-escrow-payments:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
