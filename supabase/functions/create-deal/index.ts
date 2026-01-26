import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac, createCipheriv, randomBytes } from "node:crypto";
import { Buffer } from "node:buffer";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function validateTelegramInitData(initData: string, botToken: string): { valid: boolean; user?: { id: number } } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return { valid: false };

    params.delete("hash");
    const dataCheckArr = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`);
    const dataCheckString = dataCheckArr.join("\n");

    const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
    const calculatedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    if (calculatedHash !== hash) return { valid: false };

    const userString = params.get("user");
    if (!userString) return { valid: false };

    const user = JSON.parse(userString);
    return { valid: true, user };
  } catch {
    return { valid: false };
  }
}

function encryptMnemonic(mnemonic: string, key: string): string {
  const iv = randomBytes(16);
  const keyBuffer = Buffer.from(key, "hex");
  const cipher = createCipheriv("aes-256-gcm", keyBuffer, iv);
  
  let encrypted = cipher.update(mnemonic, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:encrypted
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

// Генерация временного адреса эскроу
// В production это должен быть реальный TON кошелёк, но для MVP
// генерируем уникальный идентификатор, который будет использоваться
// для отслеживания платежей через внешний сервис
function generateEscrowAddress(): { address: string; secretKey: string } {
  // Генерируем 32 байта для секретного ключа
  const secretBytes = randomBytes(32);
  const secretKey = secretBytes.toString("hex");
  
  // Генерируем псевдо-адрес в формате TON (для MVP)
  // В production здесь будет реальная генерация через @ton/ton
  const addressBytes = randomBytes(32);
  const addressBase64 = addressBytes.toString("base64url");
  
  // Формат: UQ + 46 символов base64url (стандартный формат TON адреса)
  const address = `UQ${addressBase64.substring(0, 46)}`;
  
  return { address, secretKey };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      initData, 
      channelId, 
      postsCount, 
      pricePerPost, 
      totalPrice, 
      scheduledAt,
      campaignIds 
    } = await req.json();

    // Validate required fields
    if (!channelId || !postsCount || !pricePerPost || !totalPrice) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const encryptionKey = Deno.env.get("ENCRYPTION_KEY");
    
    if (!botToken) {
      console.error("TELEGRAM_BOT_TOKEN not set");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!encryptionKey || encryptionKey.length !== 64) {
      console.error("ENCRYPTION_KEY not set or invalid (must be 64 hex chars for AES-256)");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate Telegram initData
    const validation = validateTelegramInitData(initData || "", botToken);
    if (!validation.valid || !validation.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const telegramId = validation.user.id;

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find user by telegram_id
    const { data: user, error: findError } = await supabase
      .from("users")
      .select("id, wallet_address")
      .eq("telegram_id", telegramId)
      .single();

    if (findError || !user) {
      console.error("User not found:", findError);
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user has connected wallet
    if (!user.wallet_address) {
      return new Response(
        JSON.stringify({ success: false, error: "Wallet not connected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate escrow wallet
    console.log("Generating escrow wallet...");
    const escrowWallet = generateEscrowAddress();
    console.log("Escrow address:", escrowWallet.address);

    // Encrypt secret key (in production this would be mnemonic)
    const encryptedSecret = encryptMnemonic(escrowWallet.secretKey, encryptionKey);

    // Get channel price info
    const { data: channel, error: channelError } = await supabase
      .from("channels")
      .select("price_post")
      .eq("id", channelId)
      .single();

    if (channelError || !channel) {
      console.error("Channel not found:", channelError);
      return new Response(
        JSON.stringify({ success: false, error: "Channel not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create deal
    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .insert({
        advertiser_id: user.id,
        channel_id: channelId,
        campaign_id: campaignIds?.[0] || null, // First campaign for now
        posts_count: postsCount,
        price_per_post: pricePerPost,
        total_price: totalPrice,
        scheduled_at: scheduledAt || null,
        status: "pending",
        escrow_address: escrowWallet.address,
        escrow_mnemonic_encrypted: encryptedSecret,
        escrow_balance: 0,
      })
      .select("id, escrow_address")
      .single();

    if (dealError) {
      console.error("Failed to create deal:", dealError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create deal" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        deal: {
          id: deal.id,
          escrowAddress: deal.escrow_address,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
