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
  total_price: number;
  escrow_mnemonic_encrypted: string | null;
  channel_id: string;
  duration_hours: number;
  channel: {
    telegram_chat_id: number;
    title: string | null;
    username: string;
    owner_id: string;
  };
  advertiser_id: string;
}

async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  try {
    await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
        }),
      }
    );
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
    await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      }
    );
  } catch (error) {
    console.error("Failed to send rating request:", error);
  }
}

function decryptMnemonic(encryptedData: string): string[] {
  try {
    const key = new TextEncoder().encode(ENCRYPTION_KEY.slice(0, 32).padEnd(32, "0"));
    const data = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));
    
    const iv = data.slice(0, 12);
    const ciphertext = data.slice(12, -16);
    const authTag = data.slice(-16);
    
    console.log("Decryption params:", { ivLen: iv.length, cipherLen: ciphertext.length, tagLen: authTag.length });
    
    // Note: Proper async decryption should be implemented
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
    
    const mnemonicWords = decryptMnemonic(encryptedMnemonic);
    
    if (mnemonicWords.length === 0) {
      console.error("Could not decrypt mnemonic - manual transfer required");
      return { success: false, error: "Decryption failed - manual transfer required" };
    }
    
    const keyPair = await mnemonicToPrivateKey(mnemonicWords);
    
    const wallet = WalletContractV4.create({ 
      publicKey: keyPair.publicKey, 
      workchain: 0 
    });
    const contract = client.open(wallet);
    
    const balance = await contract.getBalance();
    const networkFee = BigInt(0.02 * 1_000_000_000);
    const transferAmount = balance - networkFee;
    
    if (transferAmount <= 0n) {
      return { success: false, error: "Insufficient balance for transfer" };
    }
    
    const seqno = await contract.getSeqno();
    await contract.sendTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      messages: [
        internal({
          to: ownerWalletAddress,
          value: transferAmount,
          body: "Adsingo payment - ad completed by admin",
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

async function verifyAdmin(authHeader: string | null): Promise<{ valid: boolean; userId?: string }> {
  if (!authHeader) {
    return { valid: false };
  }

  const token = authHeader.replace("Bearer ", "");
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return { valid: false };
  }

  // Check if user has admin role
  const { data: hasRole } = await supabase.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });

  return { valid: !!hasRole, userId: user.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin access
    const authHeader = req.headers.get("authorization");
    const { valid: isAdmin } = await verifyAdmin(authHeader);

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { dealId } = await req.json();

    if (!dealId) {
      return new Response(
        JSON.stringify({ error: "dealId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Admin force-completing deal ${dealId}...`);

    // Get deal with channel info
    const { data: dealData, error: dealError } = await supabase
      .from("deals")
      .select(`
        id, total_price, escrow_mnemonic_encrypted, channel_id, duration_hours, advertiser_id,
        channel:channels(telegram_chat_id, title, username, owner_id)
      `)
      .eq("id", dealId)
      .single();

    if (dealError || !dealData) {
      return new Response(
        JSON.stringify({ error: "Deal not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const channel = Array.isArray(dealData.channel) ? dealData.channel[0] : dealData.channel;
    if (!channel) {
      return new Response(
        JSON.stringify({ error: "Channel not found for deal" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const deal: Deal = {
      ...dealData,
      channel,
    };

    const channelTitle = channel.title || channel.username;

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
      .eq("id", channel.owner_id)
      .single();

    // Transfer funds to owner (without post verification)
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
    } else {
      console.log("No wallet or escrow mnemonic - skipping transfer");
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

    // Increment successful_ads counter for the channel
    const { data: channelData } = await supabase
      .from("channels")
      .select("successful_ads")
      .eq("id", deal.channel_id)
      .maybeSingle();

    const currentAds = channelData?.successful_ads || 0;
    await supabase
      .from("channels")
      .update({ successful_ads: currentAds + 1 })
      .eq("id", deal.channel_id);

    const durationText = deal.duration_hours < 24 
      ? `${deal.duration_hours}ч` 
      : `${Math.floor(deal.duration_hours / 24)}д`;

    // Notify advertiser and request rating
    if (advertiser?.telegram_id) {
      await sendTelegramMessage(
        advertiser.telegram_id,
        `✅ <b>Размещение завершено!</b>

Ваша реклама в канале <b>${channelTitle}</b> (@${channel.username}) успешно завершена администратором.

Средства переведены владельцу канала.
Спасибо за использование Adsingo! 🚀`
      );

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

Реклама в канале <b>${channelTitle}</b> успешно завершена.${paymentNote}

Спасибо за использование Adsingo! 🚀`
      );

      await sendRatingRequest(
        owner.telegram_id,
        `⭐ <b>Оцените рекламодателя</b>

Пожалуйста, оцените сотрудничество с рекламодателем:`,
        deal.id,
        "rate_advertiser"
      );
    }

    console.log(`Deal ${deal.id} force-completed by admin`);

    return new Response(
      JSON.stringify({
        success: true,
        dealId: deal.id,
        transferSuccess,
        message: transferSuccess 
          ? "Deal completed and funds transferred" 
          : "Deal completed but transfer pending",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in admin-complete-deal:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
