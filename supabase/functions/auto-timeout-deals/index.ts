import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createDecipheriv } from "node:crypto";
import { Buffer } from "node:buffer";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { WalletContractV4, TonClient, internal, SendMode } from "@ton/ton";

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

// Send transfer from escrow wallet
async function sendTransfer(
  encryptedMnemonic: string,
  encryptionKey: string,
  toAddress: string,
  amount: bigint,
  comment: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const mnemonic = decryptMnemonic(encryptedMnemonic, encryptionKey);
    const mnemonicArray = mnemonic.split(" ");
    
    const keyPair = await mnemonicToPrivateKey(mnemonicArray);
    
    const toncenterApiKey = Deno.env.get("TONCENTER_API_KEY");
    const client = new TonClient({
      endpoint: "https://toncenter.com/api/v2/jsonRPC",
      apiKey: toncenterApiKey,
    });
    
    const wallet = WalletContractV4.create({
      publicKey: keyPair.publicKey,
      workchain: 0,
    });
    
    const contract = client.open(wallet);
    const seqno = await contract.getSeqno();
    
    await contract.sendTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      messages: [
        internal({
          to: toAddress,
          value: amount,
          body: comment,
        }),
      ],
    });
    
    console.log(`Transfer sent: ${amount} nanoTON to ${toAddress}`);
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Transfer error:", err);
    return { success: false, error: errorMessage };
  }
}

// Get escrow balance
async function getEscrowBalance(encryptedMnemonic: string, encryptionKey: string): Promise<bigint> {
  try {
    const mnemonic = decryptMnemonic(encryptedMnemonic, encryptionKey);
    const mnemonicArray = mnemonic.split(" ");
    
    const keyPair = await mnemonicToPrivateKey(mnemonicArray);
    
    const toncenterApiKey = Deno.env.get("TONCENTER_API_KEY");
    const client = new TonClient({
      endpoint: "https://toncenter.com/api/v2/jsonRPC",
      apiKey: toncenterApiKey,
    });
    
    const wallet = WalletContractV4.create({
      publicKey: keyPair.publicKey,
      workchain: 0,
    });
    
    const contract = client.open(wallet);
    return await contract.getBalance();
  } catch (err) {
    console.error("Get balance error:", err);
    return 0n;
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
  } catch (err) {
    console.error(`Failed to send notification to ${telegramId}:`, err);
  }
}

// Get all channel team telegram IDs (owner + managers)
// deno-lint-ignore no-explicit-any
async function getChannelTeamTelegramIds(channelId: string, supabaseClient: any): Promise<number[]> {
  const { data: admins } = await supabaseClient
    .from("channel_admins")
    .select("user_id")
    .eq("channel_id", channelId);

  if (!admins?.length) return [];

  const userIds = (admins as { user_id: string }[]).map(a => a.user_id);
  const { data: users } = await supabaseClient
    .from("users")
    .select("telegram_id")
    .in("id", userIds);

  return (users as { telegram_id: number | null }[] | null)
    ?.map(u => u.telegram_id)
    .filter((id): id is number => id !== null) || [];
}

interface TimeoutDeal {
  id: string;
  total_price: number;
  payment_verified_at: string | null;
  draft_submitted_at: string | null;
  author_draft: string | null;
  is_draft_approved: boolean | null;
  escrow_mnemonic_encrypted: string | null;
  channel_id: string;
  channel: {
    title: string;
    username: string;
    owner_id: string;
  } | null;
  advertiser: {
    telegram_id: number;
    wallet_address: string | null;
  } | null;
  campaign: {
    campaign_type: string;
  } | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Checking for timed-out deals...");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encryptionKey = Deno.env.get("ENCRYPTION_KEY")!;
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const now = new Date();
    const timeout24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    
    // Find escrow deals that are timed out
    const { data: escrowDeals, error: fetchError } = await supabase
      .from("deals")
      .select(`
        id,
        total_price,
        payment_verified_at,
        draft_submitted_at,
        author_draft,
        is_draft_approved,
        escrow_mnemonic_encrypted,
        channel_id,
        channel:channels(title, username, owner_id),
        advertiser:users!deals_advertiser_id_fkey(telegram_id, wallet_address),
        campaign:campaigns(campaign_type)
      `)
      .eq("status", "escrow");
    
    if (fetchError) {
      console.error("Error fetching deals:", fetchError);
      throw fetchError;
    }
    
    if (!escrowDeals || escrowDeals.length === 0) {
      console.log("No escrow deals found");
      
      // Check if we should deactivate cron jobs
      await supabase.rpc('manage_cron_jobs', { action: 'check_and_deactivate' });
      
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    let ownerTimeoutCount = 0;
    let advertiserTimeoutCount = 0;
    let failed = 0;
    
    for (const dealRaw of escrowDeals) {
      try {
        const deal = dealRaw as unknown as TimeoutDeal;
        const channel = Array.isArray(deal.channel) ? deal.channel[0] : deal.channel;
        const advertiser = Array.isArray(deal.advertiser) ? deal.advertiser[0] : deal.advertiser;
        const campaign = Array.isArray(deal.campaign) ? deal.campaign[0] : deal.campaign;
        
        const isPromptCampaign = campaign?.campaign_type === "prompt";
        
        // Skip if no mnemonic or advertiser wallet
        if (!deal.escrow_mnemonic_encrypted || !advertiser?.wallet_address) {
          continue;
        }
        
        // SCENARIO A: Owner timeout (24h after payment, no draft for prompt campaigns)
        // Only applies to prompt campaigns where owner must write the post
        if (isPromptCampaign && !deal.author_draft && deal.payment_verified_at) {
          const paymentTime = new Date(deal.payment_verified_at);
          if (paymentTime.toISOString() < timeout24h) {
            console.log(`Deal ${deal.id}: Owner timeout - no draft after 24h`);
            
            // Get balance and send 100% refund
            const balance = await getEscrowBalance(deal.escrow_mnemonic_encrypted, encryptionKey);
            const networkFee = BigInt(0.02 * 1_000_000_000);
            const refundAmount = balance - networkFee;
            
            if (refundAmount > 0n) {
              const result = await sendTransfer(
                deal.escrow_mnemonic_encrypted,
                encryptionKey,
                advertiser.wallet_address,
                refundAmount,
                "Adsingo - возврат (владелец не ответил)"
              );
              
              if (result.success) {
                // Update deal status
                await supabase
                  .from("deals")
                  .update({
                    status: "cancelled",
                    cancellation_reason: "owner_timeout_24h",
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", deal.id);
                
                // Notify advertiser
                const channelName = channel?.title || channel?.username || "канала";
                await sendTelegramNotification(
                  botToken,
                  advertiser.telegram_id,
                  `⏰ <b>Сделка отменена автоматически</b>

Владелец ${channelName} не ответил в течение 24 часов после оплаты.

💰 <b>Возврат:</b> ${deal.total_price} TON отправлен на ваш кошелёк.`
                );
                
                // Notify channel team (owner + managers)
                const teamIds = await getChannelTeamTelegramIds(deal.channel_id, supabase);
                
                for (const telegramId of teamIds) {
                  const { data: owner } = await supabase
                    .from("users")
                    .select("telegram_id")
                    .eq("id", channel.owner_id)
                    .maybeSingle();
                  
                  const isOwner = telegramId === owner?.telegram_id;
                  
                  if (isOwner) {
                    await sendTelegramNotification(
                      botToken,
                      telegramId,
                      `⏰ <b>Сделка отменена</b>

Вы не отправили черновик в течение 24 часов после оплаты.

Средства возвращены рекламодателю.`
                    );
                  } else {
                    await sendTelegramNotification(
                      botToken,
                      telegramId,
                      `⏰ <b>Сделка отменена</b>

Черновик для канала <b>${channelName}</b> не был отправлен в течение 24 часов.

Средства возвращены рекламодателю.`
                    );
                  }
                }
                
                ownerTimeoutCount++;
                console.log(`Deal ${deal.id}: Owner timeout processed, 100% refund sent`);
              } else {
                console.error(`Deal ${deal.id}: Refund failed -`, result.error);
                failed++;
              }
            }
            continue;
          }
        }
        
        // SCENARIO B: Advertiser timeout (24h after draft submitted, no approval/revision)
        // For prompt campaigns: advertiser must approve the draft
        if (isPromptCampaign && deal.draft_submitted_at && deal.is_draft_approved === null) {
          const draftTime = new Date(deal.draft_submitted_at);
          if (draftTime.toISOString() < timeout24h) {
            console.log(`Deal ${deal.id}: Advertiser timeout - no review after 24h`);
            
            // Get balance and split 70/30
            const balance = await getEscrowBalance(deal.escrow_mnemonic_encrypted, encryptionKey);
            const networkFee = BigInt(0.04 * 1_000_000_000); // 0.04 TON for 2 transactions
            const availableAmount = balance - networkFee;
            
            if (availableAmount > 0n) {
              const ownerShare = availableAmount * 30n / 100n;
              const advertiserShare = availableAmount - ownerShare;
              
              // Get owner wallet
              let ownerWallet: string | null = null;
              if (channel?.owner_id) {
                const { data: owner } = await supabase
                  .from("users")
                  .select("wallet_address, telegram_id")
                  .eq("id", channel.owner_id)
                  .maybeSingle();
                ownerWallet = owner?.wallet_address ?? null;
              }
              
              // Send 70% to advertiser
              const advertiserResult = await sendTransfer(
                deal.escrow_mnemonic_encrypted,
                encryptionKey,
                advertiser.wallet_address,
                advertiserShare,
                "Adsingo - частичный возврат (70%)"
              );
              
              if (!advertiserResult.success) {
                console.error(`Deal ${deal.id}: Advertiser refund failed -`, advertiserResult.error);
                failed++;
                continue;
              }
              
              // Wait a bit for seqno to update
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              // Send 30% to owner (if wallet exists)
              if (ownerWallet) {
                const ownerResult = await sendTransfer(
                  deal.escrow_mnemonic_encrypted,
                  encryptionKey,
                  ownerWallet,
                  ownerShare,
                  "Adsingo - оплата за контент (30%)"
                );
                
                if (!ownerResult.success) {
                  console.error(`Deal ${deal.id}: Owner payment failed -`, ownerResult.error);
                  // Continue anyway - advertiser got their refund
                }
              }
              
              // Update deal status
              await supabase
                .from("deals")
                .update({
                  status: "cancelled",
                  cancellation_reason: "advertiser_timeout_24h",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", deal.id);
              
              // Notify advertiser
              const channelName = channel?.title || channel?.username || "канала";
              await sendTelegramNotification(
                botToken,
                advertiser.telegram_id,
                `⏰ <b>Сделка автоматически закрыта</b>

Вы не проверили черновик от ${channelName} в течение 24 часов.

💰 <b>Возврат:</b> 70% (${(Number(advertiserShare) / 1_000_000_000).toFixed(2)} TON) отправлено на ваш кошелёк.

30% отправлено автору за проделанную работу.`
              );
              
              // Notify channel team (owner + managers)
              const teamIds = await getChannelTeamTelegramIds(deal.channel_id, supabase);
              
              for (const telegramId of teamIds) {
                const { data: ownerUser } = await supabase
                  .from("users")
                  .select("telegram_id")
                  .eq("id", channel.owner_id)
                  .maybeSingle();
                
                const isOwner = telegramId === ownerUser?.telegram_id;
                
                if (isOwner) {
                  await sendTelegramNotification(
                    botToken,
                    telegramId,
                    `⏰ <b>Сделка автоматически закрыта</b>

Рекламодатель не проверил ваш черновик в течение 24 часов.

💰 <b>Вы получили:</b> 30% (${(Number(ownerShare) / 1_000_000_000).toFixed(2)} TON) за проделанную работу.`
                  );
                } else {
                  await sendTelegramNotification(
                    botToken,
                    telegramId,
                    `⏰ <b>Сделка автоматически закрыта</b>

Рекламодатель не проверил черновик для канала <b>${channelName}</b> в течение 24 часов.

Сделка завершена с частичной выплатой.`
                  );
                }
              }
              
              advertiserTimeoutCount++;
              console.log(`Deal ${deal.id}: Advertiser timeout processed, 70/30 split sent`);
            }
          }
        }
        
      } catch (dealError) {
        console.error(`Error processing deal:`, dealError);
        failed++;
      }
    }
    
    console.log(`Completed: owner_timeouts=${ownerTimeoutCount}, advertiser_timeouts=${advertiserTimeoutCount}, failed=${failed}`);
    
    // Check if we should deactivate cron jobs
    await supabase.rpc('manage_cron_jobs', { action: 'check_and_deactivate' });
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        owner_timeouts: ownerTimeoutCount,
        advertiser_timeouts: advertiserTimeoutCount,
        failed 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Error in auto-timeout-deals:", err);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
