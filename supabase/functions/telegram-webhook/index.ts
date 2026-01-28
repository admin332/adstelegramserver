import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function answerCallbackQuery(callbackQueryId: string, text: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: false,
      }),
    });
  } catch (error) {
    console.error("Failed to answer callback query:", error);
  }
}

async function editMessageReplyMarkup(chatId: number, messageId: number): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageReplyMarkup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [] },
      }),
    });
  } catch (error) {
    console.error("Failed to edit message reply markup:", error);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Received webhook:", JSON.stringify(body, null, 2));

    // Handle callback_query (inline button press)
    if (body.callback_query) {
      const { id: callbackQueryId, data, from, message } = body.callback_query;

      if (!data) {
        await answerCallbackQuery(callbackQueryId, "Неверные данные");
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      // Parse callback_data: rate_channel:dealId:rating or rate_advertiser:dealId:rating
      const parts = data.split(":");
      if (parts.length !== 3) {
        await answerCallbackQuery(callbackQueryId, "Неверный формат данных");
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      const [action, dealId, ratingStr] = parts;
      const rating = parseInt(ratingStr, 10);

      if (isNaN(rating) || rating < 1 || rating > 5) {
        await answerCallbackQuery(callbackQueryId, "Неверный рейтинг");
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      // Get deal with channel info
      const { data: deal, error: dealError } = await supabase
        .from("deals")
        .select(`
          id,
          advertiser_id,
          channel_id,
          channel:channels(owner_id)
        `)
        .eq("id", dealId)
        .maybeSingle();

      if (dealError || !deal) {
        console.error("Deal not found:", dealError);
        await answerCallbackQuery(callbackQueryId, "Сделка не найдена");
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      const telegramUserId = from.id;

      if (action === "rate_channel") {
        // Verify that the sender is the advertiser
        const { data: advertiser } = await supabase
          .from("users")
          .select("id, telegram_id")
          .eq("id", deal.advertiser_id)
          .maybeSingle();

        if (!advertiser || advertiser.telegram_id !== telegramUserId) {
          await answerCallbackQuery(callbackQueryId, "Вы не можете оценить эту сделку");
          return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        }

        // Check if review already exists
        const { data: existingReview } = await supabase
          .from("reviews")
          .select("id")
          .eq("deal_id", dealId)
          .eq("reviewer_id", advertiser.id)
          .maybeSingle();

        if (existingReview) {
          await answerCallbackQuery(callbackQueryId, "Вы уже оставили отзыв");
          // Remove buttons anyway
          if (message) {
            await editMessageReplyMarkup(message.chat.id, message.message_id);
          }
          return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        }

        // Insert review
        const { error: insertError } = await supabase
          .from("reviews")
          .insert({
            deal_id: dealId,
            channel_id: deal.channel_id,
            reviewer_id: advertiser.id,
            rating,
          });

        if (insertError) {
          console.error("Failed to insert review:", insertError);
          await answerCallbackQuery(callbackQueryId, "Ошибка при сохранении отзыва");
          return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        }

        // Remove buttons from message
        if (message) {
          await editMessageReplyMarkup(message.chat.id, message.message_id);
        }

        await answerCallbackQuery(callbackQueryId, `Спасибо за оценку ${rating} ⭐`);
        console.log(`Review saved: deal=${dealId}, rating=${rating}, reviewer=${advertiser.id}`);
      } else if (action === "rate_advertiser") {
        // Verify that the sender is the channel owner
        const channel = Array.isArray(deal.channel) ? deal.channel[0] : deal.channel;
        if (!channel) {
          await answerCallbackQuery(callbackQueryId, "Канал не найден");
          return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        }

        const { data: owner } = await supabase
          .from("users")
          .select("id, telegram_id")
          .eq("id", channel.owner_id)
          .maybeSingle();

        if (!owner || owner.telegram_id !== telegramUserId) {
          await answerCallbackQuery(callbackQueryId, "Вы не можете оценить эту сделку");
          return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        }

        // For now, just acknowledge - advertiser rating table doesn't exist yet
        // Remove buttons from message
        if (message) {
          await editMessageReplyMarkup(message.chat.id, message.message_id);
        }

        await answerCallbackQuery(callbackQueryId, `Спасибо за оценку ${rating} ⭐`);
        console.log(`Advertiser rating acknowledged: deal=${dealId}, rating=${rating}`);
      } else {
        await answerCallbackQuery(callbackQueryId, "Неизвестное действие");
      }

      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    // Handle other update types (messages, etc.) - ignore for now
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
