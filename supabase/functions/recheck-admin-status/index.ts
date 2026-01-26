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
}

// Validate Telegram initData using HMAC-SHA256
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
      data: { user, auth_date: authDate },
    };
  } catch (error) {
    console.error("Validation error:", error);
    return { valid: false };
  }
}

interface TelegramChatMember {
  status: string;
  can_post_messages?: boolean;
}

async function getChatMember(
  botToken: string, 
  chatId: number | string, 
  userId: number
): Promise<TelegramChatMember | null> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${chatId}&user_id=${userId}`
    );
    const data = await response.json();
    if (data.ok) {
      return data.result;
    }
    console.error("getChatMember error:", data);
    return null;
  } catch (error) {
    console.error("getChatMember exception:", error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      throw new Error("TELEGRAM_BOT_TOKEN not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { channel_id, initData, required_permission } = await req.json();

    // 1. Validate initData
    if (!initData) {
      return new Response(
        JSON.stringify({ valid: false, error: "Не предоставлены данные авторизации" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validation = await validateTelegramData(initData, botToken);
    if (!validation.valid || !validation.data?.user) {
      return new Response(
        JSON.stringify({ valid: false, error: "Неверные данные авторизации Telegram" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const telegramId = validation.data.user.id;
    console.log(`[recheck-admin-status] Checking user: ${telegramId} for channel: ${channel_id}`);

    if (!channel_id) {
      return new Response(
        JSON.stringify({ valid: false, error: "Не указан ID канала" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Find user in database
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ valid: false, error: "Пользователь не найден" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Get channel admin record with channel info
    const { data: adminRecord, error: adminError } = await supabase
      .from("channel_admins")
      .select("id, role, permissions, channels(telegram_chat_id)")
      .eq("channel_id", channel_id)
      .eq("user_id", userData.id)
      .single();

    if (adminError || !adminRecord) {
      return new Response(
        JSON.stringify({ valid: false, error: "Нет доступа к каналу" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TypeScript type assertion for the joined data
    const channelData = adminRecord.channels as unknown as { telegram_chat_id: number } | null;
    const telegramChatId = channelData?.telegram_chat_id;

    if (!telegramChatId) {
      return new Response(
        JSON.stringify({ valid: false, error: "Канал не найден в Telegram" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Re-check in Telegram API
    const tgMember = await getChatMember(botToken, telegramChatId, telegramId);
    const stillAdmin = tgMember && ["creator", "administrator"].includes(tgMember.status);

    if (!stillAdmin) {
      // User is no longer admin in Telegram - remove from channel_admins
      console.log(`[recheck-admin-status] User ${userData.id} is no longer admin in Telegram, removing...`);
      
      await supabase
        .from("channel_admins")
        .delete()
        .eq("id", adminRecord.id);

      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: "Ваши права администратора в Telegram были отозваны",
          removed: true
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Check required permission if specified
    const permissions = adminRecord.permissions as Record<string, boolean>;
    if (required_permission && !permissions[required_permission]) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: `У вас нет права "${required_permission}" для этого канала`,
          role: adminRecord.role,
          permissions
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Update last_verified_at
    await supabase
      .from("channel_admins")
      .update({ 
        last_verified_at: new Date().toISOString(),
        telegram_member_status: tgMember.status 
      })
      .eq("id", adminRecord.id);

    console.log(`[recheck-admin-status] User ${userData.id} verified successfully`);

    return new Response(
      JSON.stringify({
        valid: true,
        role: adminRecord.role,
        permissions,
        telegram_status: tgMember.status,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Recheck admin status error:", error);
    return new Response(
      JSON.stringify({ 
        valid: false, 
        error: error instanceof Error ? error.message : "Внутренняя ошибка сервера" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
