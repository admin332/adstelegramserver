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

async function refundToAdvertiser(
  encryptedMnemonic: string,
  advertiserWalletAddress: string,
  amount: number
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    console.log(`Initiating refund of ${amount} TON to ${advertiserWalletAddress}`);
    
    const mnemonicWords = await decryptMnemonic(encryptedMnemonic);
    
    if (mnemonicWords.length === 0) {
      console.error("Could not decrypt mnemonic - manual refund required");
      return { success: false, error: "Decryption failed - manual refund required" };
    }
    
    const keyPair = await mnemonicToPrivateKey(mnemonicWords);
    
    const wallet = WalletContractV4.create({ 
      publicKey: keyPair.publicKey, 
      workchain: 0 
    });
    const contract = client.open(wallet);
    
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
          body: "Adsingo refund - deal cancelled by admin",
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

    console.log(`Admin cancelling deal ${dealId} with refund...`);

    // Get deal with channel info
    const { data: dealData, error: dealError } = await supabase
      .from("deals")
      .select(`
        id, total_price, escrow_mnemonic_encrypted, channel_id, advertiser_id,
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
      .select("telegram_id")
      .eq("id", channel.owner_id)
      .single();

    // Refund funds to advertiser if escrow was paid
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
      console.log("No wallet or escrow mnemonic - skipping refund");
    }

    // Update deal status to cancelled
    const { error: updateError } = await supabase
      .from("deals")
      .update({
        status: "cancelled",
        cancellation_reason: "admin_cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", deal.id);

    if (updateError) {
      throw new Error(`Failed to update deal: ${updateError.message}`);
    }

    // Notify advertiser
    if (advertiser?.telegram_id) {
      const refundNote = refundSuccess 
        ? `\n\n💰 Возврат: <b>${deal.total_price} TON</b> отправлен на ваш кошелёк.`
        : deal.escrow_mnemonic_encrypted 
          ? `\n\nСредства будут возвращены на ваш кошелёк в ближайшее время.`
          : "";
      
      await sendTelegramMessage(
        advertiser.telegram_id,
        `❌ <b>Сделка отменена администратором</b>

Размещение в канале <b>${channelTitle}</b> (@${channel.username}) было отменено.${refundNote}`
      );
    }

    // Notify channel owner
    if (owner?.telegram_id) {
      await sendTelegramMessage(
        owner.telegram_id,
        `❌ <b>Сделка отменена администратором</b>

Размещение в канале <b>${channelTitle}</b> было отменено платформой.
Средства возвращены рекламодателю.`
      );
    }

    console.log(`Deal ${deal.id} cancelled by admin, refund: ${refundSuccess}`);

    return new Response(
      JSON.stringify({
        success: true,
        dealId: deal.id,
        refundSuccess,
        message: refundSuccess 
          ? "Deal cancelled and funds refunded" 
          : "Deal cancelled but refund pending or not applicable",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in admin-cancel-deal:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
