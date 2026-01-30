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

interface SettingsPayload {
  price_1_24?: number;
  price_2_48?: number;
  accepted_campaign_types?: string;
  min_hours_before_post?: number;
  auto_delete_posts?: boolean;
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

    const { initData, channel_id, settings } = await req.json() as {
      initData: string;
      channel_id: string;
      settings: SettingsPayload;
    };

    if (!initData || !channel_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[update-channel-settings] Validating initData...");
    const validation = await validateTelegramData(initData, botToken);
    
    if (!validation.valid || !validation.data?.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid Telegram data" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const telegramId = validation.data.user.id;
    console.log("[update-channel-settings] User telegram_id:", telegramId);

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

    if (userError || !user) {
      console.error("[update-channel-settings] User not found");
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin/owner of this channel
    const { data: adminEntry, error: adminError } = await supabaseAdmin
      .from("channel_admins")
      .select("role")
      .eq("user_id", user.id)
      .eq("channel_id", channel_id)
      .maybeSingle();

    if (adminError || !adminEntry) {
      console.error("[update-channel-settings] User is not admin of this channel");
      return new Response(
        JSON.stringify({ success: false, error: "Access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for active deals
    const { data: activeDeals, error: dealsError } = await supabaseAdmin
      .from("deals")
      .select("id, status")
      .eq("channel_id", channel_id)
      .in("status", ["pending", "escrow", "in_progress"]);

    if (dealsError) {
      console.error("[update-channel-settings] Error checking deals:", dealsError);
      throw dealsError;
    }

    if (activeDeals && activeDeals.length > 0) {
      console.log("[update-channel-settings] Channel has active deals, blocking update");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Невозможно изменить настройки: есть активные сделки",
          activeDealsCount: activeDeals.length
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build update object
    const updateFields: Record<string, unknown> = {};
    
    if (settings.price_1_24 !== undefined) {
      updateFields.price_1_24 = settings.price_1_24;
    }
    if (settings.price_2_48 !== undefined) {
      updateFields.price_2_48 = settings.price_2_48;
    }
    if (settings.accepted_campaign_types !== undefined) {
      if (!['prompt', 'ready_post', 'both'].includes(settings.accepted_campaign_types)) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid campaign type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      updateFields.accepted_campaign_types = settings.accepted_campaign_types;
    }
    if (settings.min_hours_before_post !== undefined) {
      if (settings.min_hours_before_post < 0 || settings.min_hours_before_post > 168) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid min_hours_before_post (0-168)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      updateFields.min_hours_before_post = settings.min_hours_before_post;
    }
    if (settings.auto_delete_posts !== undefined) {
      updateFields.auto_delete_posts = settings.auto_delete_posts;
    }

    if (Object.keys(updateFields).length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No settings to update" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    updateFields.updated_at = new Date().toISOString();

    // Update channel settings
    const { error: updateError } = await supabaseAdmin
      .from("channels")
      .update(updateFields)
      .eq("id", channel_id);

    if (updateError) {
      console.error("[update-channel-settings] Update error:", updateError);
      throw updateError;
    }

    console.log("[update-channel-settings] Settings updated successfully");

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[update-channel-settings] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
