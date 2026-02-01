import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { WalletContractV4, TonClient, internal, SendMode } from "@ton/ton";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENCRYPTION_KEY = Deno.env.get("ENCRYPTION_KEY")!;
const TONCENTER_API_KEY = Deno.env.get("TONCENTER_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Initialize TON client
const tonClient = new TonClient({
  endpoint: "https://toncenter.com/api/v2/jsonRPC",
  apiKey: TONCENTER_API_KEY,
});

// Decrypt AES-256-GCM encrypted mnemonic
async function decryptMnemonic(encryptedData: string): Promise<string[]> {
  try {
    const parts = encryptedData.split(":");
    if (parts.length !== 3) {
      console.error("Invalid encrypted format - expected 3 parts separated by ':'");
      return [];
    }
    
    const [ivHex, authTagHex, encryptedHex] = parts;
    
    const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const authTag = new Uint8Array(authTagHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const encrypted = new Uint8Array(encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    
    const ciphertextWithTag = new Uint8Array(encrypted.length + authTag.length);
    ciphertextWithTag.set(encrypted);
    ciphertextWithTag.set(authTag, encrypted.length);
    
    const keyBuffer = new Uint8Array(ENCRYPTION_KEY.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );
    
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      ciphertextWithTag
    );
    
    const mnemonicString = new TextDecoder().decode(decrypted);
    console.log("Mnemonic decrypted successfully");
    return mnemonicString.split(" ");
  } catch (error) {
    console.error("Decryption error:", error);
    return [];
  }
}

// Refund TON from escrow wallet to advertiser
async function refundToAdvertiser(
  encryptedMnemonic: string,
  advertiserWalletAddress: string,
  amount: number
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`Initiating refund of ${amount} TON to ${advertiserWalletAddress}`);
    
    const mnemonicWords = await decryptMnemonic(encryptedMnemonic);
    
    if (mnemonicWords.length === 0) {
      console.error("Could not decrypt mnemonic - manual refund required");
      return { success: false, error: "Decryption failed" };
    }
    
    const keyPair = await mnemonicToPrivateKey(mnemonicWords);
    
    const wallet = WalletContractV4.create({ 
      publicKey: keyPair.publicKey, 
      workchain: 0 
    });
    const contract = tonClient.open(wallet);
    
    const balance = await contract.getBalance();
    const networkFee = BigInt(0.02 * 1_000_000_000);
    const refundAmount = balance - networkFee;
    
    if (refundAmount <= 0n) {
      return { success: false, error: "Insufficient balance for refund" };
    }
    
    const seqno = await contract.getSeqno();
    await contract.sendTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      messages: [
        internal({
          to: advertiserWalletAddress,
          value: refundAmount,
          body: "Adsingo refund - deal rejected by owner",
        }),
      ],
    });
    
    console.log(`Refund initiated: ${refundAmount} nanoTON to ${advertiserWalletAddress}`);
    return { success: true };
  } catch (error) {
    console.error("Refund error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown refund error" 
    };
  }
}

// Media item with file_id for permanent Telegram storage
interface MediaItem {
  type: 'photo' | 'video' | 'document';
  file_id: string;
}

// =============================================================================
// Database-backed user state functions (for stateless edge function compatibility)
// =============================================================================

async function setUserState(
  telegramUserId: number, 
  stateType: string, 
  dealId: string, 
  draftIndex: number = 0
) {
  const { error } = await supabase
    .from('telegram_user_states')
    .upsert({
      telegram_user_id: telegramUserId,
      state_type: stateType,
      deal_id: dealId,
      draft_index: draftIndex,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
    }, {
      onConflict: 'telegram_user_id'
    });
  
  if (error) {
    console.error('Failed to set user state:', error);
  }
}

async function getUserState(telegramUserId: number) {
  const { data, error } = await supabase
    .from('telegram_user_states')
    .select('state_type, deal_id, draft_index')
    .eq('telegram_user_id', telegramUserId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  
  if (error) {
    console.error('Failed to get user state:', error);
    return null;
  }
  
  return data;
}

async function clearUserState(telegramUserId: number) {
  const { error } = await supabase
    .from('telegram_user_states')
    .delete()
    .eq('telegram_user_id', telegramUserId);
  
  if (error) {
    console.error('Failed to clear user state:', error);
  }
}

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

// Draft item structure for multi-draft support
interface DraftItem {
  index: number;
  text: string | null;
  entities: object[];
  media: MediaItem[];
  approved: boolean | null;
  message_id: number;
  chat_id: number;
}

// Draft history item structure for version selection
interface DraftHistoryItem {
  version: number;
  drafts: DraftItem[];
  submitted_at: string;
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

  // Find escrow deal with prompt campaign waiting for drafts
  // Now we check author_drafts array length vs posts_count
  const { data: deals } = await supabase
    .from("deals")
    .select(`
      id,
      channel_id,
      advertiser_id,
      posts_count,
      author_drafts,
      campaign:campaigns(campaign_type)
    `)
    .in("channel_id", channelIds)
    .eq("status", "escrow");

  // Filter for prompt campaigns that still need drafts
  const promptDeals = deals?.filter(d => {
    const campaign = Array.isArray(d.campaign) ? d.campaign[0] : d.campaign;
    if (campaign?.campaign_type !== "prompt") return false;
    
    // Check if more drafts are needed
    const currentDrafts = (d.author_drafts as DraftItem[]) || [];
    return currentDrafts.length < d.posts_count;
  }) || [];

  if (promptDeals.length === 0) {
    await sendTelegramMessage(telegramUserId, "📭 Нет сделок, ожидающих черновика.\n\nЕсли у вас есть активные заказы по брифу, все посты уже были отправлены.");
    return;
  }

  // Take the first pending deal
  const deal = promptDeals[0];
  const currentDrafts = (deal.author_drafts as DraftItem[]) || [];
  const requiredCount = deal.posts_count;
  const submittedCount = currentDrafts.length;

  // Extract message content with native Telegram data
  const text = (message.text || message.caption || "") as string;
  const entities = (message.entities || message.caption_entities || []) as object[];
  const media = extractMedia(message);

  if (!text && media.length === 0) {
    await sendTelegramMessage(telegramUserId, "❌ Отправьте текст поста или медиа-файлы.");
    return;
  }

  // Add new draft to array
  const newDraft: DraftItem = {
    index: submittedCount,
    text: text || null,
    entities,
    media,
    approved: null,
    message_id: message.message_id as number,
    chat_id: (message.chat as { id: number }).id,
  };

  const updatedDrafts = [...currentDrafts, newDraft];

  // Check if this is the first draft (for multi-draft deals) or the only draft
  // Set draft_submitted_at to track 24h timeout for advertiser response
  const isFirstDraft = submittedCount === 0;

  // Save to database
  const updateData: Record<string, unknown> = { author_drafts: updatedDrafts };
  if (isFirstDraft) {
    updateData.draft_submitted_at = new Date().toISOString();
  }

  const { error: updateError } = await supabase
    .from("deals")
    .update(updateData)
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
  const draftNumber = submittedCount + 1;

  // Forward the draft to advertiser
  // For multiple posts, show which draft number
  const introText = requiredCount > 1
    ? `📝 <b>Черновик ${draftNumber} из ${requiredCount} от ${channelName}</b>\n\nАвтор канала отправил пост. Проверьте его ниже:`
    : `📝 <b>Черновик поста от ${channelName}</b>\n\nАвтор канала написал пост по вашему брифу. Проверьте его ниже:`;

  await sendTelegramMessage(advertiser.telegram_id, introText);

  await new Promise(resolve => setTimeout(resolve, 300));

  // Copy the original message to advertiser (preserves formatting and premium emoji)
  const messageId = (message.message_id as number);
  const chatId = (message.chat as { id: number }).id;
  
  await copyMessage(advertiser.telegram_id, chatId, messageId);

  await new Promise(resolve => setTimeout(resolve, 300));

  // Send approval buttons with draft index
  let approvalText = requiredCount > 1
    ? `👆 <b>Проверьте черновик ${draftNumber}</b>`
    : "👆 <b>Проверьте черновик выше</b>\n\nНажмите «Одобрить» для публикации или «На доработку» с комментарием.";

  // Add 24h timeout warning
  approvalText += `\n\n⏰ У вас есть 24 часа на проверку.\n📝 Максимум 3 доработки.`;

  await sendTelegramMessage(
    advertiser.telegram_id,
    approvalText,
    {
      inline_keyboard: [
        [
          { text: "✅ Одобрить", callback_data: `approve_draft:${deal.id}:${draftNumber - 1}` },
          { text: "✏️ На доработку", callback_data: `revise_draft:${deal.id}:${draftNumber - 1}` }
        ]
      ]
    }
  );

  // Get deal with draft_history to check if version selection buttons needed
  const { data: dealWithHistory } = await supabase
    .from("deals")
    .select("draft_history")
    .eq("id", deal.id)
    .single();

  const draftHistory = (dealWithHistory?.draft_history as DraftHistoryItem[]) || [];
  const historyCount = draftHistory.length;

  // If there's history (previous versions exist), show version selection buttons
  if (historyCount > 0 && draftNumber === requiredCount) {
    // Only show after all drafts are submitted
    await new Promise(resolve => setTimeout(resolve, 500));

    const versionButtons: Array<{ text: string; callback_data: string }> = [];
    
    // Add history version buttons
    for (let i = 1; i <= historyCount; i++) {
      versionButtons.push({
        text: `📄 Вариант ${i}`,
        callback_data: `select_version:${deal.id}:${i}`
      });
    }
    
    // Current version button
    versionButtons.push({
      text: `📄 Вариант ${historyCount + 1} (текущий)`,
      callback_data: `select_version:${deal.id}:${historyCount + 1}`
    });

    // Split buttons into rows of 3
    const buttonRows: Array<Array<{ text: string; callback_data: string }>> = [];
    for (let i = 0; i < versionButtons.length; i += 3) {
      buttonRows.push(versionButtons.slice(i, i + 3));
    }

    await sendTelegramMessage(
      advertiser.telegram_id,
      `📋 <b>Доступные версии:</b>\n\nВы запрашивали доработки. Если предыдущий вариант нравился больше — выберите его:`,
      { inline_keyboard: buttonRows }
    );
  }

  // Confirm to owner
  const remaining = requiredCount - draftNumber;
  let ownerMessage = `✅ <b>Черновик ${draftNumber} из ${requiredCount} отправлен!</b>`;
  
  if (remaining > 0) {
    ownerMessage += `\n\nОсталось отправить: ${remaining} ${getPostsWord(remaining)}`;
  } else {
    ownerMessage += `\n\n🎉 Все посты отправлены! Ожидайте проверки рекламодателем.`;
  }

  await sendTelegramMessage(telegramUserId, ownerMessage);

  console.log(`Draft ${draftNumber}/${requiredCount} submitted for deal ${deal.id} with ${media.length} media items`);
}

// Handle callback query for draft approval (now with draft index)
async function handleDraftApproval(
  callbackQueryId: string, 
  dealId: string, 
  draftIndex: number,
  from: { id: number }, 
  message: { chat: { id: number }; message_id: number }
) {
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

  // Get deal with drafts array
  const { data: deal, error: dealError } = await supabase
    .from("deals")
    .select("id, status, advertiser_id, channel_id, posts_count, author_drafts")
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

  const drafts = (deal.author_drafts as DraftItem[]) || [];
  
  if (draftIndex >= drafts.length) {
    await answerCallbackQuery(callbackQueryId, "Черновик не найден");
    return;
  }

  if (drafts[draftIndex].approved === true) {
    await answerCallbackQuery(callbackQueryId, "Черновик уже одобрен");
    return;
  }

  // Update specific draft in array
  drafts[draftIndex].approved = true;

  // Check if all required drafts are submitted and approved
  const allSubmitted = drafts.length === deal.posts_count;
  const allApproved = allSubmitted && drafts.every(d => d.approved === true);

  // Update deal
  const updateData: Record<string, unknown> = { author_drafts: drafts };
  if (allApproved) {
    updateData.status = "in_progress";
    updateData.is_draft_approved = true;
    // For backwards compatibility, copy first draft to legacy fields
    if (drafts.length > 0) {
      updateData.author_draft = drafts[0].text;
      updateData.author_draft_entities = drafts[0].entities;
      updateData.author_draft_media = drafts[0].media;
    }
  }

  const { error: updateError } = await supabase
    .from("deals")
    .update(updateData)
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

  const channelName = channel?.title || `@${channel?.username}`;
  const draftNumber = draftIndex + 1;
  const approvedCount = drafts.filter(d => d.approved === true).length;

  if (allApproved) {
    // All drafts approved - notify both parties
    const postsWord = getPostsWord(deal.posts_count);
    
    await sendTelegramMessage(
      from.id,
      `✅ <b>Все ${deal.posts_count} ${postsWord} одобрены!</b>\n\nПубликация будет выполнена автоматически по расписанию.`
    );

    if (owner?.telegram_id) {
      await sendTelegramMessage(
        owner.telegram_id,
        `🎉 <b>Все посты одобрены!</b>\n\nРекламодатель принял все ${deal.posts_count} ${postsWord} для канала <b>${channelName}</b>.\n\nПубликация будет выполнена автоматически по расписанию.`
      );
    }

    await answerCallbackQuery(callbackQueryId, "Все черновики одобрены ✅");
    console.log(`All ${deal.posts_count} drafts approved for deal ${dealId}`);
  } else {
    // Partial approval
    await sendTelegramMessage(
      from.id,
      `✅ Черновик ${draftNumber} одобрен!\n\nОдобрено: ${approvedCount} из ${deal.posts_count}`
    );

    await answerCallbackQuery(callbackQueryId, `Черновик ${draftNumber} одобрен ✅`);
    console.log(`Draft ${draftNumber}/${deal.posts_count} approved for deal ${dealId}`);
  }
}

// Handle callback query for draft revision request (now with draft index)
async function handleDraftRevision(
  callbackQueryId: string, 
  dealId: string,
  draftIndex: number,
  from: { id: number }, 
  message: { chat: { id: number }; message_id: number }
) {
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

  // Get deal with revision count for limit check
  const { data: deal } = await supabase
    .from("deals")
    .select("id, advertiser_id, channel_id, revision_count")
    .eq("id", dealId)
    .single();

  if (!deal || deal.advertiser_id !== user.id) {
    await answerCallbackQuery(callbackQueryId, "Нет доступа");
    return;
  }

  // Check revision limit (max 3)
  const MAX_REVISIONS = 3;
  if ((deal.revision_count || 0) >= MAX_REVISIONS) {
    await answerCallbackQuery(callbackQueryId, `Лимит доработок исчерпан (${MAX_REVISIONS})`);
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

  // Store state for waiting revision comment in database
  await setUserState(from.id, 'awaiting_revision', dealId, draftIndex);

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
  const state = await getUserState(telegramUserId);
  if (!state || state.state_type !== 'awaiting_revision') {
    return false;
  }

  const dealId = state.deal_id;
  await clearUserState(telegramUserId);

  // Get deal with posts_count for multi-draft support and draft_history
  const { data: deal } = await supabase
    .from("deals")
    .select("id, channel_id, revision_count, posts_count, author_drafts, draft_history")
    .eq("id", dealId)
    .single();

  if (!deal) {
    await sendTelegramMessage(telegramUserId, "❌ Сделка не найдена");
    return true;
  }

  // Get current drafts and history
  const currentDrafts = (deal.author_drafts as DraftItem[]) || [];
  const currentHistory = (deal.draft_history as DraftHistoryItem[]) || [];

  // Save current version to history if drafts exist
  if (currentDrafts.length > 0) {
    const historyEntry: DraftHistoryItem = {
      version: (deal.revision_count || 0) + 1,
      drafts: currentDrafts,
      submitted_at: new Date().toISOString(),
    };
    currentHistory.push(historyEntry);
  }

  // For multi-draft: reset all drafts back to empty, but preserve history
  const { error: updateError } = await supabase
    .from("deals")
    .update({
      is_draft_approved: false,
      author_draft: null,
      author_draft_entities: [],
      author_draft_media: [],
      author_draft_media_urls: [],
      author_drafts: [], // Clear the new drafts array
      draft_history: currentHistory, // Preserve history!
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
  const postsCount = deal.posts_count || 1;
  const postsWord = getPostsWord(postsCount);

  // Notify owner with info about how many posts needed
  if (owner?.telegram_id) {
    let revisionMessage = `✏️ <b>Требуется доработка</b>\n\nРекламодатель просит изменить черновик для канала <b>${channelName}</b>.\n\n<b>Комментарий:</b>\n${text}`;
    
    if (postsCount > 1) {
      revisionMessage += `\n\n📝 Нужно отправить ${postsCount} ${postsWord} заново.`;
    } else {
      revisionMessage += `\n\nОтправьте новый черновик (текст + медиа) в этот чат.`;
    }
    
    await sendTelegramMessage(owner.telegram_id, revisionMessage);
  }

  // Confirm to advertiser
  await sendTelegramMessage(
    telegramUserId,
    `✅ <b>Комментарий отправлен!</b>\n\nАвтор канала получил ваши замечания и подготовит новый черновик.`
  );

  console.log(`Revision comment sent for deal ${dealId}, drafts saved to history (version ${currentHistory.length})`);
  return true;
}

// Handle version selection by advertiser
async function handleVersionSelect(
  callbackQueryId: string,
  dealId: string,
  version: number,
  from: { id: number },
  message: { chat: { id: number }; message_id: number }
) {
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

  // Get deal with history
  const { data: deal, error: dealError } = await supabase
    .from("deals")
    .select("id, status, advertiser_id, channel_id, revision_count, author_drafts, draft_history, posts_count")
    .eq("id", dealId)
    .single();

  if (dealError || !deal) {
    await answerCallbackQuery(callbackQueryId, "Сделка не найдена");
    return;
  }

  // Verify user is advertiser
  if (deal.advertiser_id !== user.id) {
    await answerCallbackQuery(callbackQueryId, "Только рекламодатель может выбрать версию");
    return;
  }

  if (deal.status !== "escrow") {
    await answerCallbackQuery(callbackQueryId, "Сделка уже обработана");
    return;
  }

  const history = (deal.draft_history as DraftHistoryItem[]) || [];
  const currentDrafts = (deal.author_drafts as DraftItem[]) || [];
  const currentVersion = history.length + 1;
  
  let selectedDrafts: DraftItem[];
  
  if (version === currentVersion) {
    // Use current drafts
    selectedDrafts = currentDrafts;
  } else {
    // Use history version
    const historyEntry = history.find(h => h.version === version);
    if (!historyEntry) {
      await answerCallbackQuery(callbackQueryId, "Версия не найдена");
      return;
    }
    selectedDrafts = historyEntry.drafts;
  }

  if (selectedDrafts.length === 0) {
    await answerCallbackQuery(callbackQueryId, "Черновики не найдены");
    return;
  }

  // Mark all drafts as approved
  const approvedDrafts = selectedDrafts.map(d => ({ ...d, approved: true }));

  // Update deal with selected version
  const { error: updateError } = await supabase
    .from("deals")
    .update({
      author_drafts: approvedDrafts,
      is_draft_approved: true,
      status: "in_progress",
      // For backwards compatibility, copy first draft to legacy fields
      author_draft: approvedDrafts[0]?.text || null,
      author_draft_entities: approvedDrafts[0]?.entities || [],
      author_draft_media: approvedDrafts[0]?.media || [],
    })
    .eq("id", dealId);

  if (updateError) {
    console.error("Failed to update deal with selected version:", updateError);
    await answerCallbackQuery(callbackQueryId, "Ошибка при выборе версии");
    return;
  }

  // Remove buttons
  await editMessageReplyMarkup(message.chat.id, message.message_id);

  // Get channel info and owner
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
  const postsWord = getPostsWord(deal.posts_count || 1);

  // Notify channel owner which version was selected
  if (owner?.telegram_id) {
    const ownerMessage = version === currentVersion
      ? `✅ <b>Рекламодатель выбрал текущую версию!</b>\n\nВаш последний черновик для канала <b>${channelName}</b> одобрен.\n\nВсе ${deal.posts_count} ${postsWord} будут опубликованы по расписанию.`
      : `✅ <b>Рекламодатель выбрал Вариант ${version}!</b>\n\nДля канала <b>${channelName}</b> будет опубликована предыдущая версия ${version} (не последняя).\n\nПубликация по расписанию.`;
    
    await sendTelegramMessage(owner.telegram_id, ownerMessage);
  }

  // Confirm to advertiser
  const advertiserMessage = version === currentVersion
    ? `✅ <b>Текущая версия выбрана!</b>\n\nВсе ${deal.posts_count} ${postsWord} будут опубликованы по расписанию.`
    : `✅ <b>Вариант ${version} выбран!</b>\n\nВыбранная версия будет опубликована по расписанию.`;

  await sendTelegramMessage(from.id, advertiserMessage);
  await answerCallbackQuery(callbackQueryId, `Вариант ${version} выбран!`);
  
  console.log(`Version ${version} selected for deal ${dealId} (current: ${currentVersion})`);
}

// Handle cancel revision
async function handleCancelRevision(callbackQueryId: string, dealId: string, from: { id: number }) {
  // Get state to retrieve draft_index before clearing
  const state = await getUserState(from.id);
  const draftIndex = state?.draft_index || 0;
  
  await clearUserState(from.id);
  
  // Restore approval buttons so user can try again
  await sendTelegramMessage(
    from.id,
    "❌ Запрос на доработку отменён.\n\nВы можете снова проверить черновик:",
    {
      inline_keyboard: [
        [
          { text: "✅ Одобрить", callback_data: `approve_draft:${dealId}:${draftIndex}` },
          { text: "✏️ На доработку", callback_data: `revise_draft:${dealId}:${draftIndex}` }
        ]
      ]
    }
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

  // Fetch deal with escrow_mnemonic_encrypted for refund
  const { data: deal } = await supabase
    .from("deals")
    .select("id, status, channel_id, advertiser_id, total_price, escrow_mnemonic_encrypted")
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

  // Get advertiser info with wallet for refund
  const { data: advertiser } = await supabase
    .from("users")
    .select("telegram_id, wallet_address")
    .eq("id", deal.advertiser_id)
    .single();

  // Perform refund if escrow was paid
  let refundSuccess = false;
  if (advertiser?.wallet_address && deal.escrow_mnemonic_encrypted) {
    const refundResult = await refundToAdvertiser(
      deal.escrow_mnemonic_encrypted,
      advertiser.wallet_address,
      deal.total_price
    );
    refundSuccess = refundResult.success;
    
    if (!refundSuccess) {
      console.error(`Refund failed for deal ${deal.id}:`, refundResult.error);
    }
  } else {
    console.log(`No wallet or escrow mnemonic for deal ${deal.id} - skipping refund`);
  }

  // Notify advertiser with refund status
  if (advertiser?.telegram_id) {
    const channelName = channel?.title || `@${channel?.username}`;
    const refundNote = refundSuccess
      ? `\n\n💰 Возврат: <b>${deal.total_price} TON</b> отправлен на ваш кошелёк.`
      : `\n\n💰 Средства (<b>${deal.total_price} TON</b>) будут возвращены в ближайшее время.`;
    
    await sendTelegramMessage(
      advertiser.telegram_id,
      `❌ <b>Заказ отклонён</b>\n\nВладелец канала <b>${channelName}</b> отклонил вашу рекламу.${refundNote}`
    );
  }

  // Notify owner
  const ownerMessage = refundSuccess
    ? "❌ <b>Заказ отклонён</b>\n\nСредства возвращены рекламодателю."
    : "❌ <b>Заказ отклонён</b>\n\nСредства будут возвращены рекламодателю.";
  await sendTelegramMessage(from.id, ownerMessage);
  
  await answerCallbackQuery(callbackQueryId, "Заказ отклонён");
  console.log(`Deal ${dealId} rejected by owner, refund: ${refundSuccess}`);
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

    // Handle my_chat_member (bot added/removed from channel)
    if (body.my_chat_member) {
      const { chat, new_chat_member, from } = body.my_chat_member;
      
      // Only process channels where bot became administrator
      if (chat.type === 'channel' && 
          new_chat_member.user?.is_bot && 
          (new_chat_member.status === 'administrator' || new_chat_member.status === 'creator')) {
        
        console.log(`Bot added to channel ${chat.id} (${chat.title}) by user ${from.id}`);
        
        // Save to pending_channel_verifications
        const { error: upsertError } = await supabase
          .from('pending_channel_verifications')
          .upsert({
            telegram_chat_id: chat.id,
            chat_title: chat.title || null,
            chat_username: chat.username || null,
            added_by_telegram_id: from.id,
            bot_status: new_chat_member.status,
            detected_at: new Date().toISOString(),
            processed: false,
          }, {
            onConflict: 'telegram_chat_id,added_by_telegram_id'
          });
        
        if (upsertError) {
          console.error("Failed to save channel verification:", upsertError);
        } else {
          console.log(`Saved pending verification for channel ${chat.id}`);
        }
      }
      
      // Handle bot removal
      if (chat.type === 'channel' && 
          new_chat_member.user?.is_bot && 
          (new_chat_member.status === 'left' || new_chat_member.status === 'kicked')) {
        
        console.log(`Bot removed from channel ${chat.id} by user ${from.id}`);
        
        // Mark as processed
        await supabase
          .from('pending_channel_verifications')
          .update({ processed: true })
          .eq('telegram_chat_id', chat.id);
      }
      
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

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
        const draftIndex = parts.length > 2 ? parseInt(parts[2], 10) : 0;
        await handleDraftApproval(callbackQueryId, parts[1], draftIndex, from, message);
      } else if (action === "revise_draft") {
        const draftIndex = parts.length > 2 ? parseInt(parts[2], 10) : 0;
        await handleDraftRevision(callbackQueryId, parts[1], draftIndex, from, message);
      } else if (action === "cancel_revision") {
        await handleCancelRevision(callbackQueryId, parts[1], from);
      } else if (action === "select_version") {
        const version = parseInt(parts[2], 10);
        await handleVersionSelect(callbackQueryId, parts[1], version, from, message);
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

      // Check if user is in revision comment mode (from database state)
      const state = await getUserState(telegramUserId);
      if (state?.state_type === 'awaiting_revision' && message.text) {
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
