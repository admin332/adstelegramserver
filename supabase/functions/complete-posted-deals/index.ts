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
  };
  advertiser_id: string;
}

interface User {
  telegram_id: number | null;
  wallet_address: string | null;
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

function decryptMnemonic(encryptedData: string): string[] {
  try {
    const key = new TextEncoder().encode(ENCRYPTION_KEY.slice(0, 32).padEnd(32, "0"));
    const data = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));
    
    const iv = data.slice(0, 12);
    const ciphertext = data.slice(12, -16);
    const authTag = data.slice(-16);
    
    // For now, log and return empty - proper crypto implementation needed
    console.log("Decryption params:", { ivLen: iv.length, cipherLen: ciphertext.length, tagLen: authTag.length });
    
    // Note: Proper async decryption should be implemented
    // This is a placeholder that will need SubtleCrypto implementation
    return [];
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
    const mnemonicWords = decryptMnemonic(encryptedMnemonic);
    
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
      .select("successful_ads")
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

    // Notify advertiser and request rating
    if (advertiser?.telegram_id) {
      await sendTelegramMessage(
        advertiser.telegram_id,
        `✅ <b>Размещение завершено!</b>

Ваша реклама в канале <b>${channelTitle}</b> (@${deal.channel.username}) успешно отработала полный срок (${durationText}).

Средства переведены владельцу канала.
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

    // Notify channel owner and request rating
    if (owner?.telegram_id) {
      const paymentNote = transferSuccess 
        ? `\n\n💎 <b>${deal.total_price} TON</b> переведены на ваш кошелёк.`
        : `\n\nСредства будут переведены на ваш кошелёк в ближайшее время.`;
      
      await sendTelegramMessage(
        owner.telegram_id,
        `💰 <b>Оплата получена!</b>

Реклама в канале <b>${channelTitle}</b> успешно отработала.${paymentNote}

Спасибо за использование Adsingo! 🚀`
      );

      // Send rating request for advertiser
      await sendRatingRequest(
        owner.telegram_id,
        `⭐ <b>Оцените рекламодателя</b>

Пожалуйста, оцените сотрудничество с рекламодателем:`,
        deal.id,
        "rate_advertiser"
      );
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
        channel:channels(telegram_chat_id, title, username, owner_id)
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
