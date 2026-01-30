import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface DraftItem {
  index: number;
  text: string | null;
  entities: object[];
  media: MediaItem[];
  approved: boolean | null;
  message_id?: number;
  chat_id?: number;
}

interface Deal {
  id: string;
  campaign_id: string;
  channel_id: string;
  advertiser_id: string;
  scheduled_at: string;
  posts_count: number;
  author_draft?: string;
  author_draft_entities?: object[];
  author_draft_media?: MediaItem[];
  author_draft_media_urls?: string[];
  author_drafts?: DraftItem[];
}

interface Campaign {
  text: string;
  media_urls: string[] | null;
  button_text: string | null;
  button_url: string | null;
  campaign_type: string | null;
}

interface Channel {
  telegram_chat_id: number;
  title: string | null;
  username: string;
}

interface Advertiser {
  telegram_id: number;
  first_name: string;
}

interface MediaItem {
  type: 'photo' | 'video';
  file_id: string;
}

async function sendTelegramRequest(method: string, body: Record<string, unknown>) {
  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  const result = await response.json();
  if (!result.ok) {
    console.error(`Telegram ${method} error:`, result);
    throw new Error(result.description || `Telegram ${method} failed`);
  }
  return result;
}

function isVideo(url: string): boolean {
  const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.mkv'];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowerUrl.includes(ext));
}

// Publish prompt campaign draft using file_id and entities (preserves formatting and premium emoji)
async function publishDraftToChannel(
  chatId: number,
  text: string,
  entities: object[],
  media: MediaItem[],
  buttonText?: string | null,
  buttonUrl?: string | null
): Promise<number> {
  const replyMarkup = buttonText && buttonUrl
    ? { inline_keyboard: [[{ text: buttonText, url: buttonUrl }]] }
    : undefined;

  // No media - just send text with entities
  if (!media || media.length === 0) {
    const result = await sendTelegramRequest("sendMessage", {
      chat_id: chatId,
      text,
      entities: entities.length > 0 ? entities : undefined,
      reply_markup: replyMarkup,
    });
    return result.result.message_id;
  }

  // Single media - use file_id
  if (media.length === 1) {
    const item = media[0];
    const method = item.type === 'video' ? 'sendVideo' : 'sendPhoto';
    const mediaKey = item.type === 'video' ? 'video' : 'photo';
    
    const result = await sendTelegramRequest(method, {
      chat_id: chatId,
      [mediaKey]: item.file_id,
      caption: text || undefined,
      caption_entities: entities.length > 0 ? entities : undefined,
      reply_markup: replyMarkup,
    });
    return result.result.message_id;
  }

  // Multiple media - use sendMediaGroup with file_id
  const mediaGroup = media.map((item, index) => ({
    type: item.type,
    media: item.file_id,
    ...(index === 0 && text ? { 
      caption: text, 
      caption_entities: entities.length > 0 ? entities : undefined 
    } : {}),
  }));

  const result = await sendTelegramRequest("sendMediaGroup", {
    chat_id: chatId,
    media: mediaGroup,
  });
  
  const firstMessageId = result.result[0].message_id;

  // Send button separately if exists (can't attach to media group)
  if (replyMarkup) {
    await sendTelegramRequest("sendMessage", {
      chat_id: chatId,
      text: "👆",
      reply_markup: replyMarkup,
    });
  }
  
  return firstMessageId;
}

// Publish ready_post campaign using URLs (legacy method)
async function publishToChannel(chatId: number, campaign: Campaign): Promise<number> {
  const { text, media_urls, button_text, button_url } = campaign;
  
  const replyMarkup = button_text && button_url
    ? { inline_keyboard: [[{ text: button_text, url: button_url }]] }
    : undefined;

  // No media - just send text
  if (!media_urls || media_urls.length === 0) {
    const result = await sendTelegramRequest("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: replyMarkup,
    });
    return result.result.message_id;
  }

  // Single media
  if (media_urls.length === 1) {
    const mediaUrl = media_urls[0];
    const isVideoFile = isVideo(mediaUrl);
    
    if (isVideoFile) {
      const result = await sendTelegramRequest("sendVideo", {
        chat_id: chatId,
        video: mediaUrl,
        caption: text,
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      });
      return result.result.message_id;
    } else {
      const result = await sendTelegramRequest("sendPhoto", {
        chat_id: chatId,
        photo: mediaUrl,
        caption: text,
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      });
      return result.result.message_id;
    }
  }

  // Multiple media - use sendMediaGroup
  const mediaGroup = media_urls.map((url, index) => {
    const type = isVideo(url) ? "video" : "photo";
    return {
      type,
      media: url,
      ...(index === 0 ? { caption: text, parse_mode: "HTML" } : {}),
    };
  });

  const result = await sendTelegramRequest("sendMediaGroup", {
    chat_id: chatId,
    media: mediaGroup,
  });
  
  // For media group, return the first message ID
  const firstMessageId = result.result[0].message_id;

  // Send button separately if exists (can't attach to media group)
  if (replyMarkup) {
    await sendTelegramRequest("sendMessage", {
      chat_id: chatId,
      text: "👆",
      reply_markup: replyMarkup,
    });
  }
  
  return firstMessageId;
}

async function notifyAdvertiser(
  advertiserTelegramId: number,
  channelTitle: string | null,
  channelUsername: string,
  scheduledAt: string
): Promise<void> {
  const publishDate = new Date(scheduledAt);
  const formattedDate = publishDate.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const formattedTime = publishDate.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  });

  const message = `📢 <b>Ваша реклама опубликована!</b>

Канал: ${channelTitle || channelUsername} (@${channelUsername})
Время публикации: ${formattedDate} в ${formattedTime} (МСК)

Спасибо за использование Adsingo! 🚀`;

  try {
    await sendTelegramRequest("sendMessage", {
      chat_id: advertiserTelegramId,
      text: message,
      parse_mode: "HTML",
    });
  } catch (error) {
    console.error("Failed to notify advertiser:", error);
    // Don't throw - notification failure shouldn't block the process
  }
}

async function processDeal(deal: Deal): Promise<{ success: boolean; error?: string }> {
  console.log(`Processing deal ${deal.id}...`);

  try {
    // Get campaign data
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("text, media_urls, button_text, button_url, campaign_type")
      .eq("id", deal.campaign_id)
      .single();

    if (campaignError || !campaign) {
      throw new Error(`Campaign not found: ${campaignError?.message}`);
    }

    // Get channel data
    const { data: channel, error: channelError } = await supabase
      .from("channels")
      .select("telegram_chat_id, title, username")
      .eq("id", deal.channel_id)
      .single();

    if (channelError || !channel || !channel.telegram_chat_id) {
      throw new Error(`Channel not found or no telegram_chat_id: ${channelError?.message}`);
    }

    // Get advertiser data for notification
    const { data: advertiser, error: advertiserError } = await supabase
      .from("users")
      .select("telegram_id, first_name")
      .eq("id", deal.advertiser_id)
      .single();

    if (advertiserError) {
      console.error("Failed to get advertiser:", advertiserError);
    }

    const isPromptCampaign = campaign.campaign_type === "prompt";
    const messageIds: number[] = [];

    // For prompt campaigns with multiple drafts, publish all approved drafts
    if (isPromptCampaign && deal.author_drafts && deal.author_drafts.length > 0) {
      console.log(`Publishing ${deal.author_drafts.length} prompt campaign drafts for deal ${deal.id}`);
      
      for (const draft of deal.author_drafts) {
        if (draft.approved !== true) {
          console.log(`Skipping unapproved draft ${draft.index} for deal ${deal.id}`);
          continue;
        }
        
        const messageId = await publishDraftToChannel(
          channel.telegram_chat_id,
          draft.text || "",
          draft.entities || [],
          draft.media || [],
          null, // Prompt campaigns don't use buttons (link is embedded in text)
          null
        );
        messageIds.push(messageId);
        
        console.log(`Published draft ${draft.index + 1} with message_id ${messageId}`);
        
        // Small delay between posts
        if (deal.author_drafts.indexOf(draft) < deal.author_drafts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } 
    // Legacy: single draft using old fields
    else if (isPromptCampaign && deal.author_draft) {
      console.log(`Publishing prompt campaign draft (legacy) for deal ${deal.id}`);
      
      const messageId = await publishDraftToChannel(
        channel.telegram_chat_id,
        deal.author_draft,
        deal.author_draft_entities || [],
        deal.author_draft_media || [],
        null,
        null
      );
      messageIds.push(messageId);
    } 
    // For ready_post campaigns, use campaign content with URLs
    else {
      console.log(`Publishing ready_post campaign for deal ${deal.id}`);
      
      const messageId = await publishToChannel(channel.telegram_chat_id, campaign);
      messageIds.push(messageId);
    }

    if (messageIds.length === 0) {
      throw new Error("No posts were published");
    }

    // Update deal with all message IDs
    const { error: updateError } = await supabase
      .from("deals")
      .update({
        posted_at: new Date().toISOString(),
        telegram_message_id: messageIds[0], // First for backwards compatibility
        telegram_message_ids: messageIds,   // All message IDs
      })
      .eq("id", deal.id);

    if (updateError) {
      throw new Error(`Failed to update deal: ${updateError.message}`);
    }

    // Notify advertiser
    if (advertiser?.telegram_id) {
      await notifyAdvertiser(
        advertiser.telegram_id,
        channel.title,
        channel.username,
        deal.scheduled_at
      );
    }

    console.log(`Deal ${deal.id} published successfully with ${messageIds.length} posts, message_ids: ${messageIds.join(', ')}`);
    return { success: true };
  } catch (error) {
    console.error(`Error processing deal ${deal.id}:`, error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("Checking for scheduled posts to publish...");

  try {
    // Get all in_progress deals where scheduled_at has passed
    const { data: deals, error: dealsError } = await supabase
      .from("deals")
      .select("id, campaign_id, channel_id, advertiser_id, scheduled_at, posts_count, author_draft, author_draft_entities, author_draft_media, author_draft_media_urls, author_drafts")
      .eq("status", "in_progress")
      .is("posted_at", null)
      .not("scheduled_at", "is", null)
      .lte("scheduled_at", new Date().toISOString());

    if (dealsError) {
      throw new Error(`Failed to fetch deals: ${dealsError.message}`);
    }

    if (!deals || deals.length === 0) {
      console.log("No scheduled posts ready for publication");
      return new Response(
        JSON.stringify({ success: true, message: "No posts to publish", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${deals.length} deals ready for publication`);

    // Process each deal
    const results = await Promise.all(deals.map(processDeal));
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Published: ${successful}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: deals.length,
        successful,
        failed,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in publish-scheduled-posts:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
