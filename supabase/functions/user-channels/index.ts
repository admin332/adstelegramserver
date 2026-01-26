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

async function validateTelegramData(initData: string, botToken: string): Promise<{ valid: boolean; data?: ParsedInitData }> {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");
    
    if (!hash) {
      return { valid: false };
    }

    urlParams.delete("hash");
    const dataCheckString = Array.from(urlParams.entries())
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join("\n");

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
    
    const secretKey = await crypto.subtle.importKey(
      "raw",
      secretKeyBuffer,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const dataBuffer = encoder.encode(dataCheckString);
    const hashBuffer = await crypto.subtle.sign("HMAC", secretKey, dataBuffer);
    
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const calculatedHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    if (calculatedHash !== hash) {
      return { valid: false };
    }

    const userString = urlParams.get("user");
    const authDate = parseInt(urlParams.get("auth_date") || "0", 10);
    
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      throw new Error("TELEGRAM_BOT_TOKEN not configured");
    }

    const { initData } = await req.json();

    if (!initData) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing initData" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[user-channels] Validating initData...");
    const validation = await validateTelegramData(initData, botToken);
    
    if (!validation.valid || !validation.data?.user) {
      console.log("[user-channels] Validation failed");
      return new Response(
        JSON.stringify({ success: false, error: "Invalid Telegram data" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const telegramId = validation.data.user.id;
    console.log("[user-channels] Validated telegram_id:", telegramId);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find user by telegram_id
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    if (userError) {
      console.error("[user-channels] User lookup error:", userError);
      throw userError;
    }

    if (!user) {
      console.log("[user-channels] User not found for telegram_id:", telegramId);
      return new Response(
        JSON.stringify({ success: true, channels: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[user-channels] Found user:", user.id);

    // Get channel admin entries for this user
    const { data: adminEntries, error: adminError } = await supabaseAdmin
      .from("channel_admins")
      .select("channel_id, role")
      .eq("user_id", user.id);

    if (adminError) {
      console.error("[user-channels] Admin entries error:", adminError);
      throw adminError;
    }

    if (!adminEntries || adminEntries.length === 0) {
      console.log("[user-channels] No channels for user");
      return new Response(
        JSON.stringify({ success: true, channels: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const channelIds = adminEntries.map(e => e.channel_id);

    // Get channel data (including inactive ones!)
    const { data: channels, error: channelsError } = await supabaseAdmin
      .from("channels")
      .select("id, username, title, description, avatar_url, subscribers_count, category, is_active, verified, price_1_24, price_2_48, created_at")
      .in("id", channelIds)
      .order("created_at", { ascending: false });

    if (channelsError) {
      console.error("[user-channels] Channels fetch error:", channelsError);
      throw channelsError;
    }

    // Combine channel data with user's role
    const result = (channels || []).map(ch => ({
      ...ch,
      userRole: adminEntries.find(e => e.channel_id === ch.id)?.role || 'manager',
    }));

    console.log("[user-channels] Returning", result.length, "channels");

    return new Response(
      JSON.stringify({ success: true, channels: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[user-channels] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
