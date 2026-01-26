import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendPreviewRequest {
  telegram_id: number;
  text: string;
  media_urls?: string[];
  button_text?: string;
  button_url?: string;
}

interface TelegramInlineKeyboard {
  inline_keyboard: Array<Array<{ text: string; url: string }>>;
}

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
    throw new Error(`Telegram API error: ${result.description}`);
  }
  
  return result;
}

function isVideoUrl(url: string): boolean {
  const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowerUrl.includes(ext));
}

function buildReplyMarkup(buttonText?: string, buttonUrl?: string): TelegramInlineKeyboard | undefined {
  if (buttonText && buttonUrl) {
    return {
      inline_keyboard: [[{ text: buttonText, url: buttonUrl }]],
    };
  }
  return undefined;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { telegram_id, text, media_urls, button_text, button_url }: SendPreviewRequest = await req.json();

    console.log("Sending campaign preview:", { telegram_id, text, media_urls, button_text, button_url });

    if (!telegram_id || !text) {
      return new Response(
        JSON.stringify({ error: "telegram_id and text are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fullText = text;
    const replyMarkup = buildReplyMarkup(button_text, button_url);

    // Case 1: No media - send text message
    if (!media_urls || media_urls.length === 0) {
      await sendTelegramRequest("sendMessage", {
        chat_id: telegram_id,
        text: fullText,
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
          chat_id: telegram_id,
          video: mediaUrl,
          caption: fullText,
          parse_mode: "HTML",
          ...(replyMarkup && { reply_markup: replyMarkup }),
        });
      } else {
        await sendTelegramRequest("sendPhoto", {
          chat_id: telegram_id,
          photo: mediaUrl,
          caption: fullText,
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
          ...(index === 0 && { caption: fullText, parse_mode: "HTML" }),
        };
      });

      await sendTelegramRequest("sendMediaGroup", {
        chat_id: telegram_id,
        media: mediaGroup,
      });

      // Send button as separate message after media group (if button exists)
      if (replyMarkup) {
        await sendTelegramRequest("sendMessage", {
          chat_id: telegram_id,
          text: "👆 Ваша реклама выше",
          reply_markup: replyMarkup,
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Preview sent successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending preview:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
