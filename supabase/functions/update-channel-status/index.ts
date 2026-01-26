import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface ParsedInitData {
  user?: TelegramUser;
  auth_date: number;
  hash: string;
}

// Validate Telegram initData using HMAC-SHA256
async function validateTelegramData(initData: string, botToken: string): Promise<{ valid: boolean; data?: ParsedInitData }> {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");
    
    if (!hash) {
      return { valid: false };
    }

    // Remove hash from params and sort alphabetically
    urlParams.delete("hash");
    const dataCheckString = Array.from(urlParams.entries())
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join("\n");

    // Create secret key: HMAC-SHA256("WebAppData", bot_token)
    const encoder = new TextEncoder();
    const keyData = encoder.encode("WebAppData");
    const tokenData = encoder.encode(botToken);
    
    const hmacKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const secretKeyBuffer = await crypto.subtle.sign("HMAC", hmacKey, tokenData);
    
    // Create validation hash: HMAC-SHA256(data_check_string, secret_key)
    const secretKey = await crypto.subtle.importKey(
      "raw",
      secretKeyBuffer,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const dataBuffer = encoder.encode(dataCheckString);
    const hashBuffer = await crypto.subtle.sign("HMAC", secretKey, dataBuffer);
    
    // Convert to hex
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const calculatedHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    if (calculatedHash !== hash) {
      return { valid: false };
    }

    // Parse user data
    const userString = urlParams.get("user");
    const authDate = parseInt(urlParams.get("auth_date") || "0", 10);
    
    // Check auth_date is not older than 24 hours
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) {
      return { valid: false };
    }

    let user: TelegramUser | undefined;
    if (userString) {
      user = JSON.parse(userString);
    }

    return {
      valid: true,
      data: {
        user,
        auth_date: authDate,
        hash,
      },
    };
  } catch (error) {
    console.error("Validation error:", error);
    return { valid: false };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      throw new Error("TELEGRAM_BOT_TOKEN not configured");
    }

    const { channel_id, is_active, initData } = await req.json();

    // Validate required fields
    if (!channel_id || typeof is_active !== "boolean" || !initData) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. VALIDATE INITDATA (critical for security!)
    console.log("[update-channel-status] Validating initData...");
    const validation = await validateTelegramData(initData, botToken);
    
    if (!validation.valid || !validation.data?.user) {
      console.log("[update-channel-status] Validation failed");
      return new Response(
        JSON.stringify({ success: false, error: "Invalid Telegram data" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const telegramId = validation.data.user.id;
    console.log("[update-channel-status] Validated telegram_id:", telegramId);

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 2. Find user by telegram_id
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("telegram_id", telegramId)
      .single();

    if (userError || !user) {
      console.log("[update-channel-status] User not found for telegram_id:", telegramId);
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[update-channel-status] Found user:", user.id);

    // 3. Check channel ownership
    const { data: channel, error: channelError } = await supabaseAdmin
      .from("channels")
      .select("owner_id")
      .eq("id", channel_id)
      .single();

    if (channelError || !channel) {
      console.log("[update-channel-status] Channel not found:", channel_id);
      return new Response(
        JSON.stringify({ success: false, error: "Channel not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (channel.owner_id !== user.id) {
      console.log("[update-channel-status] Access denied. Owner:", channel.owner_id, "User:", user.id);
      return new Response(
        JSON.stringify({ success: false, error: "Access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Update status (SERVICE_ROLE bypasses RLS)
    const { error: updateError } = await supabaseAdmin
      .from("channels")
      .update({ is_active })
      .eq("id", channel_id);

    if (updateError) {
      console.error("[update-channel-status] Update error:", updateError);
      throw updateError;
    }

    console.log("[update-channel-status] Success! Channel:", channel_id, "is_active:", is_active);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[update-channel-status] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
