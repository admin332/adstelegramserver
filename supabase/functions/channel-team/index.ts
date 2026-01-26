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

    const { channel_id, initData } = await req.json();

    if (!channel_id || !initData) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing channel_id or initData" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[channel-team] Validating initData for channel:", channel_id);
    const validation = await validateTelegramData(initData, botToken);
    
    if (!validation.valid || !validation.data?.user) {
      console.log("[channel-team] Validation failed");
      return new Response(
        JSON.stringify({ success: false, error: "Invalid Telegram data" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const telegramId = validation.data.user.id;
    console.log("[channel-team] Validated telegram_id:", telegramId);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find user by telegram_id
    const { data: currentUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    if (userError) {
      console.error("[channel-team] User lookup error:", userError);
      throw userError;
    }

    if (!currentUser) {
      console.log("[channel-team] User not found for telegram_id:", telegramId);
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user is an admin of this channel
    const { data: userAdminEntry, error: adminCheckError } = await supabaseAdmin
      .from("channel_admins")
      .select("id")
      .eq("channel_id", channel_id)
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (adminCheckError) {
      console.error("[channel-team] Admin check error:", adminCheckError);
      throw adminCheckError;
    }

    if (!userAdminEntry) {
      console.log("[channel-team] User is not an admin of this channel");
      return new Response(
        JSON.stringify({ success: false, error: "Access denied: not a channel admin" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all admins for this channel with user data
    const { data: admins, error: adminsError } = await supabaseAdmin
      .from("channel_admins")
      .select("id, channel_id, user_id, role, permissions, telegram_member_status, last_verified_at, created_at")
      .eq("channel_id", channel_id)
      .order("created_at", { ascending: true });

    if (adminsError) {
      console.error("[channel-team] Admins fetch error:", adminsError);
      throw adminsError;
    }

    // Get user profiles for all admins
    const userIds = admins?.map(a => a.user_id) || [];
    const { data: users, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id, first_name, last_name, username, photo_url")
      .in("id", userIds);

    if (usersError) {
      console.error("[channel-team] Users fetch error:", usersError);
      throw usersError;
    }

    // Combine admins with user data
    const usersMap = new Map(users?.map(u => [u.id, u]) || []);
    const result = (admins || []).map(admin => ({
      id: admin.id,
      channel_id: admin.channel_id,
      user_id: admin.user_id,
      role: admin.role,
      permissions: admin.permissions,
      telegram_member_status: admin.telegram_member_status,
      last_verified_at: admin.last_verified_at,
      created_at: admin.created_at,
      user: usersMap.get(admin.user_id) || null,
    }));

    console.log("[channel-team] Returning", result.length, "admins for channel");

    return new Response(
      JSON.stringify({ success: true, admins: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[channel-team] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
