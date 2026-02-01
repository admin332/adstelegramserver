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
const client = new TonClient({
  endpoint: "https://toncenter.com/api/v2/jsonRPC",
  apiKey: TONCENTER_API_KEY,
});

interface Deal {
  id: string;
  posted_at: string;
  duration_hours: number;
  total_price: number;
  telegram_message_id: number | null;
  escrow_mnemonic_encrypted: string | null;
  channel_id: string;
  channel: {
    telegram_chat_id: number;
    title: string | null;
    username: string;
    owner_id: string;
    auto_delete_posts: boolean | null;
  };
  advertiser_id: string;
}

interface User {
  telegram_id: number | null;
  wallet_address: string | null;
}

// Get all channel team telegram IDs (owner + managers)
async function getChannelTeamTelegramIds(channelId: string): Promise<number[]> {
  const { data: admins } = await supabase
    .from("channel_admins")
    .select("user_id")
    .eq("channel_id", channelId);

  if (!admins?.length) return [];

  const userIds = (admins as { user_id: string }[]).map(a => a.user_id);
  const { data: users } = await supabase
    .from("users")
    .select("telegram_id")
    .in("id", userIds);

  return (users as { telegram_id: number | null }[] | null)
    ?.map(u => u.telegram_id)
    .filter((id): id is number => id !== null) || [];
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
  return await response.json();
}

async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  try {
    await sendTelegramRequest("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    });
  } catch (error) {
    console.error("Failed to send Telegram message:", error);
  }
}

async function sendRatingRequest(
  chatId: number,
  text: string,
  dealId: string,
  ratingType: "rate_channel" | "rate_advertiser"
): Promise<void> {
  try {
    await sendTelegramRequest("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[
          { text: "1 ⭐", callback_data: `${ratingType}:${dealId}:1` },
          { text: "2 ⭐", callback_data: `${ratingType}:${dealId}:2` },
          { text: "3 ⭐", callback_data: `${ratingType}:${dealId}:3` },
          { text: "4 ⭐", callback_data: `${ratingType}:${dealId}:4` },
          { text: "5 ⭐", callback_data: `${ratingType}:${dealId}:5` },
        ]],
      },
    });
  } catch (error) {
    console.error("Failed to send rating request:", error);
  }
}

async function checkPostExists(chatId: number, messageId: number): Promise<boolean> {
  try {
    const result = await sendTelegramRequest("copyMessage", {
      chat_id: chatId,
      from_chat_id: chatId,
      message_id: messageId,
    });
    
    if (result.ok) {
      await sendTelegramRequest("deleteMessage", {
        chat_id: chatId,
        message_id: result.result.message_id,
      });
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

async function decryptMnemonic(encryptedData: string): Promise<string[]> {
  try {
    // Format: iv:authTag:encrypted (all in hex)
    const parts = encryptedData.split(":");
    if (parts.length !== 3) {
      console.error("Invalid encrypted format - expected 3 parts separated by ':'");
      return [];
    }
    
    const [ivHex, authTagHex, encryptedHex] = parts;
    
    // Decode from hex
    const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const authTag = new Uint8Array(authTagHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const encrypted = new Uint8Array(encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    
    // Combine ciphertext + authTag for SubtleCrypto
    const ciphertextWithTag = new Uint8Array(encrypted.length + authTag.length);
    ciphertextWithTag.set(encrypted);
    ciphertextWithTag.set(authTag, encrypted.length);
    
    // Import key from hex
    const keyBuffer = new Uint8Array(ENCRYPTION_KEY.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );
    
    // Decrypt
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

async function transferToOwner(
  encryptedMnemonic: string,
  ownerWalletAddress: string,
  amount: number
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    console.log(`Initiating transfer of ${amount} TON to ${ownerWalletAddress}`);
    
    // Decrypt mnemonic
    const mnemonicWords = await decryptMnemonic(encryptedMnemonic);
    
    if (mnemonicWords.length === 0) {
      // Fallback: manual transfer notification needed
      console.error("Could not decrypt mnemonic - manual transfer required");
      return { success: false, error: "Decryption failed - manual transfer required" };
    }
    
    const keyPair = await mnemonicToPrivateKey(mnemonicWords);
    
    // Create wallet contract
    const wallet = WalletContractV4.create({ 
      publicKey: keyPair.publicKey, 
      workchain: 0 
    });
    const contract = client.open(wallet);
    
    // Check balance
    const balance = await contract.getBalance();
    const networkFee = BigInt(0.02 * 1_000_000_000); // ~0.02 TON for fees
    const transferAmount = balance - networkFee;
    
    if (transferAmount <= 0n) {
      return { success: false, error: "Insufficient balance for transfer" };
    }
    
    // Send transfer
    const seqno = await contract.getSeqno();
    await contract.sendTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      messages: [
        internal({
          to: ownerWalletAddress,
          value: transferAmount,
          body: "Adsingo payment - ad completed successfully",
        }),
      ],
    });
    
    console.log(`Transfer initiated: ${transferAmount} nanoTON to ${ownerWalletAddress}`);
    return { success: true };
  } catch (error) {
    console.error("Transfer error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown transfer error" 
    };
  }
}

async function refundToAdvertiser(
  deal: Deal,
  advertiserWallet: string
): Promise<{ success: boolean; error?: string }> {
  if (!deal.escrow_mnemonic_encrypted) {
    return { success: false, error: "No escrow mnemonic" };
  }
  
  return await transferToOwner(
    deal.escrow_mnemonic_encrypted,
    advertiserWallet,
    deal.total_price
  );
}

async function processDeal(deal: Deal): Promise<{ success: boolean; refunded?: boolean; error?: string }> {
  console.log(`Processing deal ${deal.id} for completion...`);

  try {
    const channelTitle = deal.channel.title || deal.channel.username;

    // Get advertiser data
    const { data: advertiser } = await supabase
      .from("users")
      .select("telegram_id, wallet_address")
      .eq("id", deal.advertiser_id)
      .single();

    // Get channel owner data
    const { data: owner } = await supabase
      .from("users")
      .select("telegram_id, wallet_address")
      .eq("id", deal.channel.owner_id)
      .single();

    // Final post integrity check before completing
    if (deal.telegram_message_id && deal.channel.telegram_chat_id) {
      const postExists = await checkPostExists(deal.channel.telegram_chat_id, deal.telegram_message_id);
      
      if (!postExists) {
        console.log(`Post deleted for deal ${deal.id}, initiating refund...`);
        
        // Refund to advertiser
        if (advertiser?.wallet_address && deal.escrow_mnemonic_encrypted) {
          const refundResult = await refundToAdvertiser(deal, advertiser.wallet_address);
          console.log(`Refund result:`, refundResult);
        }
        
        // Update deal as cancelled
        await supabase
          .from("deals")
          .update({
            status: "cancelled",
            cancellation_reason: "post_deleted",
            completed_at: new Date().toISOString(),
          })
          .eq("id", deal.id);
        
        // Notify advertiser about refund
        if (advertiser?.telegram_id) {
          await sendTelegramMessage(
            advertiser.telegram_id,
            `⚠️ <b>Пост удалён из канала</b>

Ваша реклама в канале <b>${channelTitle}</b> (@${deal.channel.username}) была удалена до окончания срока размещения.

💰 <b>Возврат:</b> ${deal.total_price} TON отправлен на ваш кошелёк.`
          );
        }
        
        // Notify channel owner
        if (owner?.telegram_id) {
          await sendTelegramMessage(
            owner.telegram_id,
            `🚫 <b>Сделка отменена</b>

Рекламный пост в канале <b>${channelTitle}</b> был удалён до окончания срока размещения.

Средства возвращены рекламодателю. Подобные действия могут привести к понижению рейтинга.`
          );
        }
        
        return { success: true, refunded: true };
      }
    }

    // Post exists - transfer funds to owner
    let transferSuccess = false;
    if (owner?.wallet_address && deal.escrow_mnemonic_encrypted) {
      const transferResult = await transferToOwner(
        deal.escrow_mnemonic_encrypted,
        owner.wallet_address,
        deal.total_price
      );
      transferSuccess = transferResult.success;
      
      if (!transferSuccess) {
        console.error(`Transfer failed for deal ${deal.id}:`, transferResult.error);
      }
    }

    // Update deal status to completed
    const { error: updateError } = await supabase
      .from("deals")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", deal.id);

    if (updateError) {
      throw new Error(`Failed to update deal: ${updateError.message}`);
    }

    const durationText = deal.duration_hours < 24 
      ? `${deal.duration_hours}ч` 
      : `${Math.floor(deal.duration_hours / 24)}д`;

    // Increment successful_ads counter for the channel using raw update
    const { data: channelData } = await supabase
      .from("channels")
      .select("successful_ads, auto_delete_posts")
      .eq("id", deal.channel_id)
      .maybeSingle();

    const currentAds = channelData?.successful_ads || 0;
    const { error: incrementError } = await supabase
      .from("channels")
      .update({ successful_ads: currentAds + 1 })
      .eq("id", deal.channel_id);

    if (incrementError) {
      console.error("Failed to increment successful_ads:", incrementError);
    } else {
      console.log(`Incremented successful_ads for channel ${deal.channel_id}`);
    }

    // Auto-delete all posts if enabled
    let postDeleted = false;
    if (channelData?.auto_delete_posts && deal.channel.telegram_chat_id) {
      console.log(`Auto-delete enabled for channel ${deal.channel_id}, deleting all posts...`);
      
      // Get all message IDs from the deal
      const { data: dealData } = await supabase
        .from("deals")
        .select("telegram_message_ids")
        .eq("id", deal.id)
        .single();
      
      const messageIds: number[] = [];
      
      // Add IDs from array if available
      if (dealData?.telegram_message_ids && Array.isArray(dealData.telegram_message_ids)) {
        messageIds.push(...(dealData.telegram_message_ids as number[]));
      }
      
      // Fallback to single message ID if array is empty
      if (messageIds.length === 0 && deal.telegram_message_id) {
        messageIds.push(deal.telegram_message_id);
      }
      
      console.log(`Found ${messageIds.length} messages to delete for deal ${deal.id}`);
      
      // Delete all messages
      for (const messageId of messageIds) {
        try {
          const deleteResult = await sendTelegramRequest("deleteMessage", {
            chat_id: deal.channel.telegram_chat_id,
            message_id: messageId,
          });
          if (deleteResult.ok === true) {
            postDeleted = true;
            console.log(`Deleted message ${messageId} for deal ${deal.id}`);
          } else {
            console.log(`Failed to delete message ${messageId}:`, deleteResult);
          }
        } catch (deleteError) {
          console.error(`Failed to auto-delete message ${messageId} for deal ${deal.id}:`, deleteError);
        }
      }
    }

    // Notify advertiser and request rating
    if (advertiser?.telegram_id) {
      const autoDeleteNote = postDeleted ? "\n\n🗑️ Рекламный пост был автоматически удалён." : "";
      
      await sendTelegramMessage(
        advertiser.telegram_id,
        `✅ <b>Размещение завершено!</b>

Ваша реклама в канале <b>${channelTitle}</b> (@${deal.channel.username}) успешно отработала полный срок (${durationText}).

Средства переведены владельцу канала.${autoDeleteNote}
Спасибо за использование Adsingo! 🚀`
      );

      // Send rating request
      await sendRatingRequest(
        advertiser.telegram_id,
        `⭐ <b>Оцените работу канала</b>

Пожалуйста, оцените качество размещения в канале <b>${channelTitle}</b>:`,
        deal.id,
        "rate_channel"
      );
    }

    // Notify channel team (owner + managers)
    const teamIds = await getChannelTeamTelegramIds(deal.channel_id);
    
    for (const telegramId of teamIds) {
      const isOwner = telegramId === owner?.telegram_id;
      const autoDeleteNote = postDeleted ? "\n\n🗑️ Рекламный пост был автоматически удалён." : "";
      
      if (isOwner && owner?.telegram_id) {
        // Owner: show payment info
        const paymentNote = transferSuccess 
          ? `\n\n💎 <b>${deal.total_price} TON</b> переведены на ваш кошелёк.`
          : `\n\nСредства будут переведены на ваш кошелёк в ближайшее время.`;
        
        await sendTelegramMessage(
          telegramId,
          `💰 <b>Оплата получена!</b>

Реклама в канале <b>${channelTitle}</b> успешно отработала.${paymentNote}${autoDeleteNote}

Спасибо за использование Adsingo! 🚀`
        );

        // Send rating request for advertiser (only to owner)
        await sendRatingRequest(
          telegramId,
          `⭐ <b>Оцените рекламодателя</b>

Пожалуйста, оцените сотрудничество с рекламодателем:`,
          deal.id,
          "rate_advertiser"
        );
      } else {
        // Manager: simplified message without payment info
        await sendTelegramMessage(
          telegramId,
          `✅ <b>Сделка завершена!</b>

Реклама в канале <b>${channelTitle}</b> успешно отработала.${autoDeleteNote}

Спасибо за использование Adsingo! 🚀`
        );
      }
    }

    console.log(`Deal ${deal.id} completed successfully`);
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

  console.log("Checking for posted deals ready for completion...");

  try {
    // Get all in_progress deals where posted_at is set
    const { data: deals, error: dealsError } = await supabase
      .from("deals")
      .select(`
        id, posted_at, duration_hours, total_price, advertiser_id,
        telegram_message_id, escrow_mnemonic_encrypted, channel_id,
        channel:channels(telegram_chat_id, title, username, owner_id, auto_delete_posts)
      `)
      .eq("status", "in_progress")
      .not("posted_at", "is", null);

    if (dealsError) {
      throw new Error(`Failed to fetch deals: ${dealsError.message}`);
    }

    if (!deals || deals.length === 0) {
      console.log("No posted deals found");
      
      // Check if we should deactivate cron jobs (no more active deals)
      const { data: cronResult } = await supabase.rpc('manage_cron_jobs', { action: 'check_and_deactivate' });
      console.log("Cron jobs management:", cronResult);
      
      return new Response(
        JSON.stringify({ success: true, message: "No deals to complete", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${deals.length} posted deals to check`);

    const now = new Date();
    const dealsToComplete: Deal[] = [];
    
    // Minimum buffer to prevent completing deals immediately after posting
    const MIN_BUFFER_HOURS = 1;

    for (const deal of deals) {
      if (!deal.posted_at) continue;
      
      const channel = Array.isArray(deal.channel) ? deal.channel[0] : deal.channel;
      if (!channel) continue;

      const postedAt = new Date(deal.posted_at);
      const minWaitTime = new Date(postedAt.getTime() + MIN_BUFFER_HOURS * 60 * 60 * 1000);
      const completionTime = new Date(postedAt.getTime() + deal.duration_hours * 60 * 60 * 1000);

      // Only complete if both: duration has passed AND minimum buffer has passed
      if (now >= completionTime && now >= minWaitTime) {
        dealsToComplete.push({
          id: deal.id,
          posted_at: deal.posted_at,
          duration_hours: deal.duration_hours,
          total_price: deal.total_price,
          advertiser_id: deal.advertiser_id,
          telegram_message_id: deal.telegram_message_id,
          escrow_mnemonic_encrypted: deal.escrow_mnemonic_encrypted,
          channel_id: deal.channel_id,
          channel: channel as Deal["channel"],
        });
      }
    }

    if (dealsToComplete.length === 0) {
      console.log("No deals ready for completion yet");
      
      // Still check if we should deactivate cron jobs
      const { data: cronResult } = await supabase.rpc('manage_cron_jobs', { action: 'check_and_deactivate' });
      console.log("Cron jobs management:", cronResult);
      
      return new Response(
        JSON.stringify({ success: true, message: "No deals ready for completion", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`${dealsToComplete.length} deals ready for completion`);

    // Process each deal
    const results = await Promise.all(dealsToComplete.map(processDeal));

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Completed: ${successful}, Failed: ${failed}`);

    // Check if we should deactivate cron jobs (no more active deals)
    const { data: cronResult } = await supabase.rpc('manage_cron_jobs', { action: 'check_and_deactivate' });
    console.log("Cron jobs management:", cronResult);

    return new Response(
      JSON.stringify({
        success: true,
        processed: dealsToComplete.length,
        successful,
        failed,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in complete-posted-deals:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
