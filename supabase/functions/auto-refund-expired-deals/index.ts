import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createDecipheriv } from "node:crypto";
import { Buffer } from "node:buffer";
import { mnemonicToPrivateKey } from "npm:@ton/crypto@3";
import { WalletContractV4, TonClient, internal, SendMode } from "npm:@ton/ton@15";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Decrypt mnemonic from encrypted storage
function decryptMnemonic(encrypted: string, key: string): string {
  const [ivHex, authTagHex, encryptedData] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const keyBuffer = Buffer.from(key, "hex");
  
  const decipher = createDecipheriv("aes-256-gcm", keyBuffer, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

// Send refund from escrow wallet to advertiser
async function sendRefund(
  encryptedMnemonic: string,
  encryptionKey: string,
  toAddress: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Decrypt mnemonic
    const mnemonic = decryptMnemonic(encryptedMnemonic, encryptionKey);
    const mnemonicArray = mnemonic.split(" ");
    
    // 2. Get keypair
    const keyPair = await mnemonicToPrivateKey(mnemonicArray);
    
    // 3. Create TON client
    const toncenterApiKey = Deno.env.get("TONCENTER_API_KEY");
    const client = new TonClient({
      endpoint: "https://toncenter.com/api/v2/jsonRPC",
      apiKey: toncenterApiKey,
    });
    
    // 4. Create wallet contract
    const wallet = WalletContractV4.create({
      publicKey: keyPair.publicKey,
      workchain: 0,
    });
    
    const contract = client.open(wallet);
    
    // 5. Check balance
    const balance = await contract.getBalance();
    const networkFee = BigInt(0.02 * 1_000_000_000); // ~0.02 TON for network fee
    const refundAmount = balance - networkFee;
    
    console.log(`Escrow balance: ${balance}, refund amount: ${refundAmount}`);
    
    if (refundAmount <= 0n) {
      return { success: false, error: "Insufficient balance for refund" };
    }
    
    // 6. Get seqno
    const seqno = await contract.getSeqno();
    
    // 7. Send transaction
    await contract.sendTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      messages: [
        internal({
          to: toAddress,
          value: refundAmount,
          body: "Adsingo refund - time expired",
        }),
      ],
    });
    
    console.log(`Refund sent to ${toAddress}, amount: ${refundAmount}`);
    return { success: true };
  } catch (error) {
    console.error("Refund error:", error);
    return { success: false, error: error.message };
  }
}

// Send Telegram notification
async function sendTelegramNotification(
  botToken: string,
  telegramId: number,
  message: string
): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        text: message,
        parse_mode: "HTML",
      }),
    });
  } catch (error) {
    console.error(`Failed to send notification to ${telegramId}:`, error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Checking for expired escrow deals...");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encryptionKey = Deno.env.get("ENCRYPTION_KEY")!;
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const now = new Date().toISOString();
    
    // Find escrow deals where scheduled_at has passed
    const { data: expiredDeals, error: fetchError } = await supabase
      .from("deals")
      .select(`
        id,
        total_price,
        escrow_mnemonic_encrypted,
        scheduled_at,
        channel:channels(title, username, owner_id),
        advertiser:users!deals_advertiser_id_fkey(telegram_id, wallet_address, first_name)
      `)
      .eq("status", "escrow")
      .lt("scheduled_at", now);
    
    if (fetchError) {
      console.error("Error fetching expired deals:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch deals" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!expiredDeals || expiredDeals.length === 0) {
      console.log("No expired escrow deals found");
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`Found ${expiredDeals.length} expired escrow deal(s)`);
    
    let processed = 0;
    let failed = 0;
    
    for (const deal of expiredDeals) {
      try {
        const advertiser = deal.advertiser as { telegram_id: number; wallet_address: string | null; first_name: string } | null;
        const channel = deal.channel as { title: string; username: string; owner_id: string } | null;
        
        if (!advertiser?.wallet_address) {
          console.error(`Deal ${deal.id}: Advertiser wallet address not found, skipping`);
          failed++;
          continue;
        }
        
        if (!deal.escrow_mnemonic_encrypted) {
          console.error(`Deal ${deal.id}: Escrow mnemonic not found, skipping`);
          failed++;
          continue;
        }
        
        // Send refund
        console.log(`Processing refund for deal ${deal.id}...`);
        const refundResult = await sendRefund(
          deal.escrow_mnemonic_encrypted,
          encryptionKey,
          advertiser.wallet_address
        );
        
        if (!refundResult.success) {
          console.error(`Deal ${deal.id}: Refund failed - ${refundResult.error}`);
          failed++;
          continue;
        }
        
        // Update deal status to cancelled with reason
        const { error: updateError } = await supabase
          .from("deals")
          .update({
            status: "cancelled",
            cancellation_reason: "auto_expired",
            updated_at: new Date().toISOString(),
          })
          .eq("id", deal.id);
        
        if (updateError) {
          console.error(`Deal ${deal.id}: Failed to update status -`, updateError);
          failed++;
          continue;
        }
        
        // Get channel owner's telegram_id
        if (channel?.owner_id) {
          const { data: owner } = await supabase
            .from("users")
            .select("telegram_id")
            .eq("id", channel.owner_id)
            .maybeSingle();
          
          // Notify channel owner
          if (owner?.telegram_id) {
            const ownerMessage = `⏰ <b>Сделка автоматически отменена</b>

Вы не одобрили рекламу до запланированного времени публикации.

Средства возвращены рекламодателю.`;
            
            await sendTelegramNotification(botToken, owner.telegram_id, ownerMessage);
          }
        }
        
        // Notify advertiser
        if (advertiser.telegram_id) {
          const channelTitle = channel?.title || channel?.username || "канала";
          const advertiserMessage = `💔 <b>Время публикации истекло</b>

К сожалению, владелец ${channelTitle} не успел одобрить вашу рекламу до запланированного времени.

💰 <b>Возврат:</b> ${deal.total_price} TON отправлен на ваш кошелёк.`;
          
          await sendTelegramNotification(botToken, advertiser.telegram_id, advertiserMessage);
        }
        
        processed++;
        console.log(`Deal ${deal.id} successfully refunded and cancelled`);
        
      } catch (dealError) {
        console.error(`Error processing deal ${deal.id}:`, dealError);
        failed++;
      }
    }
    
    console.log(`Completed: ${processed} processed, ${failed} failed`);
    
    return new Response(
      JSON.stringify({ success: true, processed, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Error in auto-refund-expired-deals:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
