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

interface Deal {
  id: string;
  telegram_message_id: number;
  total_price: number;
  escrow_mnemonic_encrypted: string | null;
  channel: {
    telegram_chat_id: number;
    title: string | null;
    username: string;
    owner_id: string;
  };
  advertiser_id: string;
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
  const [ivHex, authTagHex, encryptedHex] = encryptedData.split(":");
  
  const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const authTag = new Uint8Array(authTagHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const encrypted = new Uint8Array(encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  
  const ciphertextWithTag = new Uint8Array(encrypted.length + authTag.length);
  ciphertextWithTag.set(encrypted);
  ciphertextWithTag.set(authTag, encrypted.length);
  
  const keyBuffer = new Uint8Array(ENCRYPTION_KEY.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyBuffer, { name: "AES-GCM" }, false, ["decrypt"]
  );
  
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv }, cryptoKey, ciphertextWithTag
  );
  
  return new TextDecoder().decode(decrypted).split(" ");
}

async function refundToAdvertiser(deal: Deal): Promise<boolean> {
  console.log(`Processing refund for deal ${deal.id}...`);
  
  const { data: advertiser } = await supabase
    .from("users")
    .select("telegram_id, wallet_address")
    .eq("id", deal.advertiser_id)
    .single();

  if (!advertiser?.wallet_address || !deal.escrow_mnemonic_encrypted) {
    console.error("Missing wallet or mnemonic for refund");
    return false;
  }

  try {
    const mnemonicWords = await decryptMnemonic(deal.escrow_mnemonic_encrypted);
    
    if (mnemonicWords.length === 0) {
      console.error("Could not decrypt mnemonic");
      return false;
    }

    const keyPair = await mnemonicToPrivateKey(mnemonicWords);
    
    const client = new TonClient({
      endpoint: "https://toncenter.com/api/v2/jsonRPC",
      apiKey: TONCENTER_API_KEY,
    });

    const wallet = WalletContractV4.create({
      publicKey: keyPair.publicKey,
      workchain: 0,
    });
    
    const contract = client.open(wallet);
    const balance = await contract.getBalance();
    const networkFee = BigInt(0.02 * 1_000_000_000);
    const refundAmount = balance - networkFee;

    if (refundAmount <= 0n) {
      console.error("Insufficient balance for refund");
      return false;
    }

    const seqno = await contract.getSeqno();
    await contract.sendTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      messages: [
        internal({
          to: advertiser.wallet_address,
          value: refundAmount,
          body: "Adsingo refund - post deleted",
        }),
      ],
    });

    console.log(`Refund sent: ${refundAmount} nanoTON to ${advertiser.wallet_address}`);
    return true;
  } catch (error) {
    console.error("Refund error:", error);
    return false;
  }
}

async function processDeal(deal: Deal): Promise<{ success: boolean; deleted: boolean; error?: string }> {
  console.log(`Checking post integrity for deal ${deal.id}...`);

  try {
    const channel = deal.channel;
    
    if (!channel?.telegram_chat_id) {
      return { success: false, deleted: false, error: "No telegram_chat_id" };
    }

    const postExists = await checkPostExists(channel.telegram_chat_id, deal.telegram_message_id);

    if (!postExists) {
      console.log(`Post deleted for deal ${deal.id}, initiating refund...`);
      
      const { data: advertiser } = await supabase
        .from("users")
        .select("telegram_id")
        .eq("id", deal.advertiser_id)
        .single();

      const { data: owner } = await supabase
        .from("users")
        .select("telegram_id")
        .eq("id", channel.owner_id)
        .single();

      // Process actual refund
      const refundSuccess = await refundToAdvertiser(deal);

      // Update deal status
      const { error: updateError } = await supabase
        .from("deals")
        .update({
          status: "cancelled",
          cancellation_reason: "post_deleted",
          completed_at: new Date().toISOString(),
        })
        .eq("id", deal.id);

      if (updateError) {
        throw new Error(`Failed to update deal: ${updateError.message}`);
      }

      const channelTitle = channel.title || channel.username;

      // Notify advertiser
      if (advertiser?.telegram_id) {
        const refundText = refundSuccess 
          ? `💰 <b>Возврат:</b> ${deal.total_price} TON отправлен на ваш кошелёк.`
          : `⚠️ Возврат средств не удался. Пожалуйста, обратитесь в поддержку.`;
        
        await sendTelegramMessage(
          advertiser.telegram_id,
          `⚠️ <b>Пост удалён из канала</b>

Ваша реклама в канале <b>${channelTitle}</b> (@${channel.username}) была удалена до окончания срока размещения.

${refundText}`
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

      return { success: true, deleted: true };
    }

    // Post exists - update last check timestamp
    await supabase
      .from("deals")
      .update({ last_integrity_check_at: new Date().toISOString() })
      .eq("id", deal.id);

    console.log(`Post verified for deal ${deal.id}`);
    return { success: true, deleted: false };
  } catch (error) {
    console.error(`Error checking deal ${deal.id}:`, error);
    return { success: false, deleted: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("Checking post integrity for active deals...");

  try {
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    
    const { data: deals, error: dealsError } = await supabase
      .from("deals")
      .select(`
        id, telegram_message_id, total_price, escrow_mnemonic_encrypted, advertiser_id,
        channel:channels(telegram_chat_id, title, username, owner_id)
      `)
      .eq("status", "in_progress")
      .not("posted_at", "is", null)
      .not("telegram_message_id", "is", null)
      .or(`last_integrity_check_at.is.null,last_integrity_check_at.lt.${fourHoursAgo}`);

    if (dealsError) {
      throw new Error(`Failed to fetch deals: ${dealsError.message}`);
    }

    if (!deals || deals.length === 0) {
      console.log("No deals require integrity check");
      return new Response(
        JSON.stringify({ success: true, message: "No deals to check", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${deals.length} deals to check`);

    const results = await Promise.all(
      deals.map((deal) => {
        const channel = Array.isArray(deal.channel) ? deal.channel[0] : deal.channel;
        return processDeal({
          ...deal,
          channel: channel as Deal["channel"],
        } as Deal);
      })
    );

    const successful = results.filter((r) => r.success).length;
    const deleted = results.filter((r) => r.deleted).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`Checked: ${successful}, Deleted posts: ${deleted}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: deals.length,
        successful,
        deleted,
        failed,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in verify-post-integrity:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
