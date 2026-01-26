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
  can_change_info?: boolean;
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

    const { channel_id, initData } = await req.json();

    // 1. Validate initData
    if (!initData) {
      return new Response(
        JSON.stringify({ success: false, error: "Не предоставлены данные авторизации" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validation = await validateTelegramData(initData, botToken);
    if (!validation.valid || !validation.data?.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Неверные данные авторизации Telegram" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const telegramId = validation.data.user.id;
    console.log(`[join-channel-as-admin] Validated user: ${telegramId}`);

    if (!channel_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Не указан ID канала" }),
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
        JSON.stringify({ success: false, error: "Пользователь не найден" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Get channel info
    const { data: channel, error: channelError } = await supabase
      .from("channels")
      .select("id, telegram_chat_id, title")
      .eq("id", channel_id)
      .single();

    if (channelError || !channel) {
      return new Response(
        JSON.stringify({ success: false, error: "Канал не найден" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Check if user is already an admin
    const { data: existingAdmin } = await supabase
      .from("channel_admins")
      .select("id, role")
      .eq("channel_id", channel_id)
      .eq("user_id", userData.id)
      .maybeSingle();

    if (existingAdmin) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Вы уже являетесь администратором этого канала",
          role: existingAdmin.role
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Check in Telegram API if user is admin/creator
    const tgMember = await getChatMember(botToken, channel.telegram_chat_id!, telegramId);
    
    if (!tgMember || !["creator", "administrator"].includes(tgMember.status)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Вы не являетесь администратором этого канала в Telegram" 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Determine role and permissions
    const isCreator = tgMember.status === "creator";
    const role = isCreator ? "owner" : "manager";
    const permissions = isCreator
      ? { can_edit_posts: true, can_view_stats: true, can_view_finance: true, can_withdraw: true, can_manage_admins: true, can_approve_ads: true }
      : { can_edit_posts: true, can_view_stats: true, can_view_finance: false, can_withdraw: false, can_manage_admins: false, can_approve_ads: true };

    // 7. Insert into channel_admins
    const { error: insertError } = await supabase
      .from("channel_admins")
      .insert({
        channel_id: channel.id,
        user_id: userData.id,
        role,
        telegram_member_status: tgMember.status,
        permissions,
        last_verified_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Ошибка добавления администратора" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[join-channel-as-admin] User ${userData.id} joined channel ${channel.id} as ${role}`);

    // Send notification to channel owner (only for managers, not when owner joins)
    if (role === "manager") {
      const { data: ownerAdmin } = await supabase
        .from("channel_admins")
        .select("user_id")
        .eq("channel_id", channel.id)
        .eq("role", "owner")
        .maybeSingle();

      if (ownerAdmin && ownerAdmin.user_id !== userData.id) {
        const { data: ownerUser } = await supabase
          .from("users")
          .select("telegram_id")
          .eq("id", ownerAdmin.user_id)
          .single();

        const { data: newManager } = await supabase
          .from("users")
          .select("first_name, last_name, username")
          .eq("id", userData.id)
          .single();

        if (ownerUser?.telegram_id && newManager) {
          const managerName = [newManager.first_name, newManager.last_name]
            .filter(Boolean)
            .join(" ");
          const managerUsername = newManager.username ? `@${newManager.username}` : "";

          const notificationText = `🆕 <b>Новый менеджер в команде!</b>

Канал: <b>${channel.title}</b>

Присоединился: <b>${managerName}</b>${managerUsername ? ` (${managerUsername})` : ""}

Теперь этот пользователь может управлять рекламой на вашем канале.`;

          try {
            await fetch(
              `https://api.telegram.org/bot${botToken}/sendMessage`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: ownerUser.telegram_id,
                  text: notificationText,
                  parse_mode: "HTML",
                }),
              }
            );
            console.log(`[join-channel-as-admin] Notification sent to owner ${ownerUser.telegram_id}`);
          } catch (notifyError) {
            console.error("[join-channel-as-admin] Failed to notify owner:", notifyError);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Вы добавлены как ${role === 'owner' ? 'владелец' : 'менеджер'} канала`,
        role,
        permissions,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Join channel error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Внутренняя ошибка сервера" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
