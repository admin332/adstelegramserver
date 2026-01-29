import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Store for tracking users waiting for draft input
// Format: { telegramId: { dealId: string, step: 'awaiting_draft' | 'awaiting_revision' } }
interface UserState {
  dealId: string;
  step: 'awaiting_draft' | 'awaiting_revision';
  advertiserTelegramId?: number;
}

// Media item with file_id for permanent Telegram storage
interface MediaItem {
  type: 'photo' | 'video' | 'document';
  file_id: string;
}

// In-memory state (will reset on function restart, but that's OK for this use case)
const userStates: Map<number, UserState> = new Map();

async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: Record<string, unknown>) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  };
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }
  
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json();
}

async function forwardMessage(chatId: number, fromChatId: number, messageId: number) {
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/forwardMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      from_chat_id: fromChatId,
      message_id: messageId,
    }),
  });
  return response.json();
}

async function copyMessage(chatId: number, fromChatId: number, messageId: number, replyMarkup?: Record<string, unknown>) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    from_chat_id: fromChatId,
    message_id: messageId,
  };
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }
  
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/copyMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json();
}

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

async function editMessageReplyMarkup(chatId: number, messageId: number, replyMarkup?: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageReplyMarkup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: replyMarkup || { inline_keyboard: [] },
      }),
    });
  } catch (error) {
    console.error("Failed to edit message reply markup:", error);
  }
}

// Extract media with file_id (permanent Telegram storage)
function extractMedia(message: Record<string, unknown>): MediaItem[] {
  const media: MediaItem[] = [];
  
  // Photo - get largest size
  if (message.photo && Array.isArray(message.photo)) {
    const largestPhoto = message.photo[message.photo.length - 1] as { file_id: string };
    media.push({ type: 'photo', file_id: largestPhoto.file_id });
  }
  
  // Video
  if (message.video) {
    const video = message.video as { file_id: string };
    media.push({ type: 'video', file_id: video.file_id });
  }
  
  // Document (for images/videos sent as files)
  if (message.document) {
    const doc = message.document as { file_id: string; mime_type?: string };
    if (doc.mime_type?.startsWith('image/')) {
      media.push({ type: 'photo', file_id: doc.file_id });
    } else if (doc.mime_type?.startsWith('video/')) {
      media.push({ type: 'video', file_id: doc.file_id });
    }
  }
  
  return media;
}

// Handle incoming message from channel owner (draft submission)
async function handleDraftMessage(telegramUserId: number, message: Record<string, unknown>) {
  // Get user from DB
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("telegram_id", telegramUserId)
    .maybeSingle();

  if (!user) {
    await sendTelegramMessage(telegramUserId, "❌ Пользователь не найден. Откройте приложение Adsingo для авторизации.");
    return;
  }

  // Find pending prompt deal for this user (as channel owner)
  const { data: channelAdmins } = await supabase
    .from("channel_admins")
    .select("channel_id")
    .eq("user_id", user.id);

  const channelIds = channelAdmins?.map(ca => ca.channel_id) || [];

  if (channelIds.length === 0) {
    await sendTelegramMessage(telegramUserId, "❌ У вас нет каналов. Добавьте канал в приложении Adsingo.");
    return;
  }

  // Find escrow deal with prompt campaign waiting for draft
  const { data: deals } = await supabase
    .from("deals")
    .select(`
      id,
      channel_id,
      advertiser_id,
      author_draft,
      is_draft_approved,
      campaign:campaigns(campaign_type)
    `)
    .in("channel_id", channelIds)
    .eq("status", "escrow")
    .is("author_draft", null);

  // Filter for prompt campaigns only
  const promptDeals = deals?.filter(d => {
    const campaign = Array.isArray(d.campaign) ? d.campaign[0] : d.campaign;
    return campaign?.campaign_type === "prompt";
  }) || [];

  if (promptDeals.length === 0) {
    await sendTelegramMessage(telegramUserId, "📭 Нет сделок, ожидающих черновика.\n\nЕсли у вас есть активные заказы по брифу, черновик уже был отправлен.");
    return;
  }

  // Take the first pending deal
  const deal = promptDeals[0];

  // Extract message content with native Telegram data
  const text = (message.text || message.caption || "") as string;
  const entities = (message.entities || message.caption_entities || []) as object[];
  const media = extractMedia(message);

  if (!text && media.length === 0) {
    await sendTelegramMessage(telegramUserId, "❌ Отправьте текст поста или медиа-файлы.");
    return;
  }

  // Save draft to database with file_id and entities
  const { error: updateError } = await supabase
    .from("deals")
    .update({
      author_draft: text || null,
      author_draft_entities: entities,
      author_draft_media: media,
      author_draft_media_urls: [], // Clear legacy field
      is_draft_approved: null, // Waiting for review
    })
    .eq("id", deal.id);

  if (updateError) {
    console.error("Failed to save draft:", updateError);
    await sendTelegramMessage(telegramUserId, "❌ Не удалось сохранить черновик. Попробуйте позже.");
    return;
  }

  // Get advertiser telegram_id
  const { data: advertiser } = await supabase
    .from("users")
    .select("telegram_id")
    .eq("id", deal.advertiser_id)
    .single();

  if (!advertiser?.telegram_id) {
    await sendTelegramMessage(telegramUserId, "✅ Черновик сохранён, но не удалось уведомить рекламодателя.");
    return;
  }

  // Get channel info
  const { data: channel } = await supabase
    .from("channels")
    .select("title, username")
    .eq("id", deal.channel_id)
    .single();

  const channelName = channel?.title || `@${channel?.username}` || "канала";

  // Forward the draft to advertiser
  // First, send intro message
  await sendTelegramMessage(
    advertiser.telegram_id,
    `📝 <b>Черновик поста от ${channelName}</b>\n\nАвтор канала написал пост по вашему брифу. Проверьте его ниже:`
  );

  await new Promise(resolve => setTimeout(resolve, 300));

  // Copy the original message to advertiser (preserves formatting and premium emoji)
  const messageId = (message.message_id as number);
  const chatId = (message.chat as { id: number }).id;
  
  await copyMessage(advertiser.telegram_id, chatId, messageId);

  await new Promise(resolve => setTimeout(resolve, 300));

  // Send approval buttons
  await sendTelegramMessage(
    advertiser.telegram_id,
    "👆 <b>Проверьте черновик выше</b>\n\nНажмите «Одобрить» для публикации или «На доработку» с комментарием.",
    {
      inline_keyboard: [
        [
          { text: "✅ Одобрить", callback_data: `approve_draft:${deal.id}` },
          { text: "✏️ На доработку", callback_data: `revise_draft:${deal.id}` }
        ]
      ]
    }
  );

  // Confirm to owner
  await sendTelegramMessage(
    telegramUserId,
    "✅ <b>Черновик отправлен рекламодателю!</b>\n\nОжидайте проверки. Вы получите уведомление о результате."
  );

  console.log(`Draft submitted for deal ${deal.id} with ${media.length} media items and ${entities.length} entities`);
}

// Handle callback query for draft approval
async function handleDraftApproval(callbackQueryId: string, dealId: string, from: { id: number }, message: { chat: { id: number }; message_id: number }) {
  // Get user
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("telegram_id", from.id)
    .maybeSingle();

  if (!user) {
    await answerCallbackQuery(callbackQueryId, "Пользователь не найден");
    return;
  }

  // Get deal
  const { data: deal, error: dealError } = await supabase
    .from("deals")
    .select("id, status, advertiser_id, channel_id, author_draft")
    .eq("id", dealId)
    .single();

  if (dealError || !deal) {
    await answerCallbackQuery(callbackQueryId, "Сделка не найдена");
    return;
  }

  // Verify user is advertiser
  if (deal.advertiser_id !== user.id) {
    await answerCallbackQuery(callbackQueryId, "Только рекламодатель может одобрить черновик");
    return;
  }

  if (deal.status !== "escrow") {
    await answerCallbackQuery(callbackQueryId, "Сделка уже обработана");
    return;
  }

  if (!deal.author_draft) {
    await answerCallbackQuery(callbackQueryId, "Черновик ещё не отправлен");
    return;
  }

  // Approve draft
  const { error: updateError } = await supabase
    .from("deals")
    .update({
      is_draft_approved: true,
      status: "in_progress",
    })
    .eq("id", dealId);

  if (updateError) {
    console.error("Failed to approve draft:", updateError);
    await answerCallbackQuery(callbackQueryId, "Ошибка при одобрении");
    return;
  }

  // Remove buttons
  await editMessageReplyMarkup(message.chat.id, message.message_id);

  // Get channel owner
  const { data: channel } = await supabase
    .from("channels")
    .select("owner_id, title, username")
    .eq("id", deal.channel_id)
    .single();

  const { data: owner } = await supabase
    .from("users")
    .select("telegram_id")
    .eq("id", channel?.owner_id)
    .single();

  // Notify owner
  if (owner?.telegram_id) {
    const channelName = channel?.title || `@${channel?.username}`;
    await sendTelegramMessage(
      owner.telegram_id,
      `✅ <b>Черновик одобрен!</b>\n\nРекламодатель принял ваш пост для канала <b>${channelName}</b>.\n\nПубликация будет выполнена автоматически по расписанию.`
    );
  }

  // Confirm to advertiser
  await sendTelegramMessage(
    from.id,
    "✅ <b>Черновик одобрен!</b>\n\nПост будет опубликован автоматически по расписанию."
  );

  await answerCallbackQuery(callbackQueryId, "Черновик одобрен ✅");
  console.log(`Draft approved for deal ${dealId}`);
}

// Handle callback query for draft revision request
async function handleDraftRevision(callbackQueryId: string, dealId: string, from: { id: number }, message: { chat: { id: number }; message_id: number }) {
  // Get user
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("telegram_id", from.id)
    .maybeSingle();

  if (!user) {
    await answerCallbackQuery(callbackQueryId, "Пользователь не найден");
    return;
  }

  // Get deal
  const { data: deal } = await supabase
    .from("deals")
    .select("id, advertiser_id, channel_id")
    .eq("id", dealId)
    .single();

  if (!deal || deal.advertiser_id !== user.id) {
    await answerCallbackQuery(callbackQueryId, "Нет доступа");
    return;
  }

  // Get channel owner telegram_id
  const { data: channel } = await supabase
    .from("channels")
    .select("owner_id")
    .eq("id", deal.channel_id)
    .single();

  const { data: owner } = await supabase
    .from("users")
    .select("telegram_id")
    .eq("id", channel?.owner_id)
    .single();

  // Store state for waiting revision comment
  userStates.set(from.id, {
    dealId,
    step: 'awaiting_revision',
    advertiserTelegramId: from.id,
  });

  // Remove buttons
  await editMessageReplyMarkup(message.chat.id, message.message_id);

  // Ask for revision comment
  await sendTelegramMessage(
    from.id,
    "✏️ <b>Напишите комментарий для автора</b>\n\nОпишите, что нужно изменить в посте:",
    {
      inline_keyboard: [
        [{ text: "❌ Отмена", callback_data: `cancel_revision:${dealId}` }]
      ]
    }
  );

  await answerCallbackQuery(callbackQueryId, "Напишите комментарий");
  console.log(`Revision requested for deal ${dealId}, waiting for comment`);
}

// Handle revision comment from advertiser
async function handleRevisionComment(telegramUserId: number, text: string) {
  const state = userStates.get(telegramUserId);
  if (!state || state.step !== 'awaiting_revision') {
    return false;
  }

  const dealId = state.dealId;
  userStates.delete(telegramUserId);

  // Get deal
  const { data: deal } = await supabase
    .from("deals")
    .select("id, channel_id, revision_count")
    .eq("id", dealId)
    .single();

  if (!deal) {
    await sendTelegramMessage(telegramUserId, "❌ Сделка не найдена");
    return true;
  }

  // Update deal - clear all draft fields including new ones
  const { error: updateError } = await supabase
    .from("deals")
    .update({
      is_draft_approved: false,
      author_draft: null,
      author_draft_entities: [],
      author_draft_media: [],
      author_draft_media_urls: [], // Clear legacy field
      revision_count: (deal.revision_count || 0) + 1,
    })
    .eq("id", dealId);

  if (updateError) {
    console.error("Failed to update deal for revision:", updateError);
    await sendTelegramMessage(telegramUserId, "❌ Ошибка. Попробуйте позже.");
    return true;
  }

  // Get channel owner
  const { data: channel } = await supabase
    .from("channels")
    .select("owner_id, title, username")
    .eq("id", deal.channel_id)
    .single();

  const { data: owner } = await supabase
    .from("users")
    .select("telegram_id")
    .eq("id", channel?.owner_id)
    .single();

  const channelName = channel?.title || `@${channel?.username}`;

  // Notify owner
  if (owner?.telegram_id) {
    await sendTelegramMessage(
      owner.telegram_id,
      `✏️ <b>Требуется доработка</b>

Рекламодатель просит изменить черновик для канала <b>${channelName}</b>.

<b>Комментарий:</b>
${text}

Отправьте новый черновик (текст + медиа) в этот чат.`
    );
  }

  // Confirm to advertiser
  await sendTelegramMessage(
    telegramUserId,
    `✅ <b>Комментарий отправлен!</b>\n\nАвтор канала получил ваши замечания и подготовит новый черновик.`
  );

  console.log(`Revision comment sent for deal ${dealId}`);
  return true;
}

// Handle cancel revision
async function handleCancelRevision(callbackQueryId: string, dealId: string, from: { id: number }) {
  userStates.delete(from.id);
  
  // Restore approval buttons
  await sendTelegramMessage(
    from.id,
    "❌ Запрос на доработку отменён.\n\nВы можете снова проверить черновик в приложении Adsingo.",
  );

  await answerCallbackQuery(callbackQueryId, "Отменено");
}

// Handle deal approval by owner (for ready_post campaigns)
async function handleDealApproval(callbackQueryId: string, dealId: string, from: { id: number }, message: { chat: { id: number }; message_id: number }) {
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("telegram_id", from.id)
    .maybeSingle();

  if (!user) {
    await answerCallbackQuery(callbackQueryId, "Пользователь не найден");
    return;
  }

  const { data: deal } = await supabase
    .from("deals")
    .select("id, status, channel_id, advertiser_id")
    .eq("id", dealId)
    .single();

  if (!deal) {
    await answerCallbackQuery(callbackQueryId, "Сделка не найдена");
    return;
  }

  // Verify user is channel owner
  const { data: channel } = await supabase
    .from("channels")
    .select("owner_id, title, username")
    .eq("id", deal.channel_id)
    .single();

  if (channel?.owner_id !== user.id) {
    // Check if admin
    const { data: admin } = await supabase
      .from("channel_admins")
      .select("id")
      .eq("channel_id", deal.channel_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!admin) {
      await answerCallbackQuery(callbackQueryId, "Нет доступа");
      return;
    }
  }

  if (deal.status !== "escrow") {
    await answerCallbackQuery(callbackQueryId, "Сделка уже обработана");
    return;
  }

  // Approve deal
  const { error: updateError } = await supabase
    .from("deals")
    .update({
      status: "in_progress",
    })
    .eq("id", dealId);

  if (updateError) {
    await answerCallbackQuery(callbackQueryId, "Ошибка при одобрении");
    return;
  }

  // Remove buttons
  await editMessageReplyMarkup(message.chat.id, message.message_id);

  // Notify advertiser
  const { data: advertiser } = await supabase
    .from("users")
    .select("telegram_id")
    .eq("id", deal.advertiser_id)
    .single();

  if (advertiser?.telegram_id) {
    const channelName = channel?.title || `@${channel?.username}`;
    await sendTelegramMessage(
      advertiser.telegram_id,
      `✅ <b>Реклама одобрена!</b>\n\nВладелец канала <b>${channelName}</b> одобрил вашу рекламу. Публикация будет выполнена автоматически по расписанию.`
    );
  }

  await sendTelegramMessage(from.id, "✅ <b>Заказ принят!</b>\n\nПубликация будет выполнена автоматически по расписанию.");
  await answerCallbackQuery(callbackQueryId, "Заказ принят ✅");
  console.log(`Deal ${dealId} approved by owner`);
}

// Handle deal rejection by owner
async function handleDealRejection(callbackQueryId: string, dealId: string, from: { id: number }, message: { chat: { id: number }; message_id: number }) {
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("telegram_id", from.id)
    .maybeSingle();

  if (!user) {
    await answerCallbackQuery(callbackQueryId, "Пользователь не найден");
    return;
  }

  const { data: deal } = await supabase
    .from("deals")
    .select("id, status, channel_id, advertiser_id, total_price")
    .eq("id", dealId)
    .single();

  if (!deal) {
    await answerCallbackQuery(callbackQueryId, "Сделка не найдена");
    return;
  }

  // Verify access
  const { data: channel } = await supabase
    .from("channels")
    .select("owner_id, title, username")
    .eq("id", deal.channel_id)
    .single();

  const isOwner = channel?.owner_id === user.id;
  
  if (!isOwner) {
    const { data: admin } = await supabase
      .from("channel_admins")
      .select("id")
      .eq("channel_id", deal.channel_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!admin) {
      await answerCallbackQuery(callbackQueryId, "Нет доступа");
      return;
    }
  }

  if (deal.status !== "escrow") {
    await answerCallbackQuery(callbackQueryId, "Сделка уже обработана");
    return;
  }

  // Reject deal
  const { error: updateError } = await supabase
    .from("deals")
    .update({
      status: "cancelled",
      cancellation_reason: "owner_rejected",
    })
    .eq("id", dealId);

  if (updateError) {
    await answerCallbackQuery(callbackQueryId, "Ошибка при отклонении");
    return;
  }

  // Remove buttons
  await editMessageReplyMarkup(message.chat.id, message.message_id);

  // Notify advertiser
  const { data: advertiser } = await supabase
    .from("users")
    .select("telegram_id")
    .eq("id", deal.advertiser_id)
    .single();

  if (advertiser?.telegram_id) {
    const channelName = channel?.title || `@${channel?.username}`;
    await sendTelegramMessage(
      advertiser.telegram_id,
      `❌ <b>Заказ отклонён</b>\n\nВладелец канала <b>${channelName}</b> отклонил вашу рекламу.\n\n💰 Средства (<b>${deal.total_price} TON</b>) будут возвращены автоматически.`
    );
  }

  await sendTelegramMessage(from.id, "❌ <b>Заказ отклонён</b>\n\nСредства будут возвращены рекламодателю.");
  await answerCallbackQuery(callbackQueryId, "Заказ отклонён");
  console.log(`Deal ${dealId} rejected by owner`);
}

// Handle ratings
async function handleRating(callbackQueryId: string, action: string, dealId: string, ratingStr: string, from: { id: number }, message: { chat: { id: number }; message_id: number }) {
  const rating = parseInt(ratingStr, 10);

  if (isNaN(rating) || rating < 1 || rating > 5) {
    await answerCallbackQuery(callbackQueryId, "Неверный рейтинг");
    return;
  }

  const { data: deal } = await supabase
    .from("deals")
    .select(`
      id,
      advertiser_id,
      channel_id,
      channel:channels(owner_id)
    `)
    .eq("id", dealId)
    .maybeSingle();

  if (!deal) {
    await answerCallbackQuery(callbackQueryId, "Сделка не найдена");
    return;
  }

  if (action === "rate_channel") {
    const { data: advertiser } = await supabase
      .from("users")
      .select("id, telegram_id")
      .eq("id", deal.advertiser_id)
      .maybeSingle();

    if (!advertiser || advertiser.telegram_id !== from.id) {
      await answerCallbackQuery(callbackQueryId, "Вы не можете оценить эту сделку");
      return;
    }

    const { data: existingReview } = await supabase
      .from("reviews")
      .select("id")
      .eq("deal_id", dealId)
      .eq("reviewer_id", advertiser.id)
      .maybeSingle();

    if (existingReview) {
      await answerCallbackQuery(callbackQueryId, "Вы уже оставили отзыв");
      await editMessageReplyMarkup(message.chat.id, message.message_id);
      return;
    }

    const { error: insertError } = await supabase
      .from("reviews")
      .insert({
        deal_id: dealId,
        channel_id: deal.channel_id,
        reviewer_id: advertiser.id,
        rating,
      });

    if (insertError) {
      await answerCallbackQuery(callbackQueryId, "Ошибка при сохранении отзыва");
      return;
    }

    await editMessageReplyMarkup(message.chat.id, message.message_id);
    await answerCallbackQuery(callbackQueryId, `Спасибо за оценку ${rating} ⭐`);
    
  } else if (action === "rate_advertiser") {
    const channel = Array.isArray(deal.channel) ? deal.channel[0] : deal.channel;
    if (!channel) {
      await answerCallbackQuery(callbackQueryId, "Канал не найден");
      return;
    }

    const { data: owner } = await supabase
      .from("users")
      .select("id, telegram_id")
      .eq("id", channel.owner_id)
      .maybeSingle();

    if (!owner || owner.telegram_id !== from.id) {
      await answerCallbackQuery(callbackQueryId, "Вы не можете оценить эту сделку");
      return;
    }

    const { data: existingReview } = await supabase
      .from("advertiser_reviews")
      .select("id")
      .eq("deal_id", dealId)
      .maybeSingle();

    if (existingReview) {
      await answerCallbackQuery(callbackQueryId, "Вы уже оставили отзыв");
      await editMessageReplyMarkup(message.chat.id, message.message_id);
      return;
    }

    const { error: insertError } = await supabase
      .from("advertiser_reviews")
      .insert({
        deal_id: dealId,
        advertiser_id: deal.advertiser_id,
        reviewer_id: owner.id,
        rating,
      });

    if (insertError) {
      await answerCallbackQuery(callbackQueryId, "Ошибка при сохранении отзыва");
      return;
    }

    await editMessageReplyMarkup(message.chat.id, message.message_id);
    await answerCallbackQuery(callbackQueryId, `Спасибо за оценку ${rating} ⭐`);
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

      const parts = data.split(":");
      const action = parts[0];

      // Handle draft approval/revision
      if (action === "approve_draft") {
        await handleDraftApproval(callbackQueryId, parts[1], from, message);
      } else if (action === "revise_draft") {
        await handleDraftRevision(callbackQueryId, parts[1], from, message);
      } else if (action === "cancel_revision") {
        await handleCancelRevision(callbackQueryId, parts[1], from);
      }
      // Handle deal approval/rejection
      else if (action === "approve_deal") {
        await handleDealApproval(callbackQueryId, parts[1], from, message);
      } else if (action === "reject_deal") {
        await handleDealRejection(callbackQueryId, parts[1], from, message);
      }
      // Handle ratings
      else if (action === "rate_channel" || action === "rate_advertiser") {
        if (parts.length === 3) {
          await handleRating(callbackQueryId, action, parts[1], parts[2], from, message);
        }
      }
      else {
        await answerCallbackQuery(callbackQueryId, "Неизвестное действие");
      }

      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    // Handle regular messages (draft submissions from channel owners)
    if (body.message) {
      const message = body.message;
      const from = message.from;
      
      if (!from?.id) {
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      const telegramUserId = from.id;

      // Check if user is in revision comment mode
      const state = userStates.get(telegramUserId);
      if (state?.step === 'awaiting_revision' && message.text) {
        const handled = await handleRevisionComment(telegramUserId, message.text);
        if (handled) {
          return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        }
      }

      // Handle as draft submission
      await handleDraftMessage(telegramUserId, message);
    }

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
