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
    
    if (!hash) return { valid: false };

    urlParams.delete("hash");
    const dataCheckString = Array.from(urlParams.entries())
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join("\n");

    const encoder = new TextEncoder();
    const keyData = encoder.encode("WebAppData");
    const tokenData = encoder.encode(botToken);
    
    const hmacKey = await crypto.subtle.importKey(
      "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    
    const secretKeyBuffer = await crypto.subtle.sign("HMAC", hmacKey, tokenData);
    
    const secretKey = await crypto.subtle.importKey(
      "raw", secretKeyBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    
    const dataBuffer = encoder.encode(dataCheckString);
    const hashBuffer = await crypto.subtle.sign("HMAC", secretKey, dataBuffer);
    
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const calculatedHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    if (calculatedHash !== hash) return { valid: false };

    const userString = urlParams.get("user");
    const authDate = parseInt(urlParams.get("auth_date") || "0", 10);
    
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) return { valid: false };

    let user: TelegramUser | undefined;
    if (userString) {
      user = JSON.parse(userString);
    }

    return { valid: true, data: { user, auth_date: authDate, hash } };
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
    if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN not configured");

    const { initData, channel_id } = await req.json();

    if (!initData || !channel_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[channel-stats-for-owner] Validating initData...");
    const validation = await validateTelegramData(initData, botToken);
    
    if (!validation.valid || !validation.data?.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid Telegram data" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const telegramId = validation.data.user.id;
    console.log("[channel-stats-for-owner] User telegram_id:", telegramId);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find user
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin of this channel
    const { data: adminEntry, error: adminError } = await supabaseAdmin
      .from("channel_admins")
      .select("role")
      .eq("user_id", user.id)
      .eq("channel_id", channel_id)
      .maybeSingle();

    if (adminError || !adminEntry) {
      return new Response(
        JSON.stringify({ success: false, error: "Access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get favorites count
    const { count: favoritesCount, error: favError } = await supabaseAdmin
      .from("favorites")
      .select("*", { count: "exact", head: true })
      .eq("channel_id", channel_id);

    if (favError) {
      console.error("[channel-stats-for-owner] Favorites count error:", favError);
    }

    // Get completed deals count
    const { count: completedDealsCount, error: dealsError } = await supabaseAdmin
      .from("deals")
      .select("*", { count: "exact", head: true })
      .eq("channel_id", channel_id)
      .eq("status", "completed");

    if (dealsError) {
      console.error("[channel-stats-for-owner] Deals count error:", dealsError);
    }

    // Get channel settings
    const { data: channel, error: channelError } = await supabaseAdmin
      .from("channels")
      .select("price_1_24, price_2_48, accepted_campaign_types, min_hours_before_post, auto_delete_posts")
      .eq("id", channel_id)
      .single();

    if (channelError) {
      console.error("[channel-stats-for-owner] Channel fetch error:", channelError);
      throw channelError;
    }

    console.log("[channel-stats-for-owner] Stats fetched successfully");

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          favorites_count: favoritesCount || 0,
          completed_deals_count: completedDealsCount || 0,
        },
        settings: {
          price_1_24: channel.price_1_24,
          price_2_48: channel.price_2_48,
          accepted_campaign_types: channel.accepted_campaign_types || 'both',
          min_hours_before_post: channel.min_hours_before_post || 0,
          auto_delete_posts: channel.auto_delete_posts || false,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[channel-stats-for-owner] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
