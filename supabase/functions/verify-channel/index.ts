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

interface VerifyChannelRequest {
  username: string;
  initData: string;
  category: string;
  price_1_24?: number;
  price_2_48?: number;
  price_post?: number;
}

interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
  description?: string;
  photo?: {
    small_file_id: string;
    big_file_id: string;
  };
}

interface TelegramChatMember {
  status: string;
  can_post_messages?: boolean;
}

async function getBotId(botToken: string): Promise<number | null> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await response.json();
    if (data.ok) {
      return data.result.id;
    }
    return null;
  } catch {
    return null;
  }
}

async function getChat(botToken: string, chatId: string): Promise<TelegramChat | null> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getChat?chat_id=${encodeURIComponent(chatId)}`
    );
    const data = await response.json();
    if (data.ok) {
      return data.result;
    }
    console.error("getChat error:", data);
    return null;
  } catch (error) {
    console.error("getChat exception:", error);
    return null;
  }
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

async function getChatMemberCount(botToken: string, chatId: number | string): Promise<number> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getChatMemberCount?chat_id=${chatId}`
    );
    const data = await response.json();
    if (data.ok) {
      return data.result;
    }
    return 0;
  } catch {
    return 0;
  }
}

async function getFileUrl(botToken: string, fileId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    );
    const data = await response.json();
    if (data.ok && data.result.file_path) {
      return `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;
    }
    return null;
  } catch {
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

    const body: VerifyChannelRequest = await req.json();
    const { username, initData, category, price_1_24, price_2_48, price_post } = body;

    // 1. VALIDATE INITDATA (critical for security!)
    if (!initData) {
      return new Response(
        JSON.stringify({ success: false, error: "Не предоставлены данные авторизации" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validation = await validateTelegramData(initData, botToken);
    if (!validation.valid || !validation.data?.user) {
      console.log("[verify-channel] Invalid Telegram data");
      return new Response(
        JSON.stringify({ success: false, error: "Неверные данные авторизации Telegram" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const telegramId = validation.data.user.id;
    console.log(`[verify-channel] Validated user: ${telegramId}`);

    // Username всегда обязателен (category проверяется позже только для новых каналов)
    if (!username) {
      return new Response(
        JSON.stringify({ success: false, error: "Не указан username канала" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get bot ID
    const botId = await getBotId(botToken);
    if (!botId) {
      return new Response(
        JSON.stringify({ success: false, error: "Ошибка конфигурации бота" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format channel username
    const chatId = username.startsWith("@") ? username : `@${username}`;

    // Get channel info
    const chat = await getChat(botToken, chatId);
    if (!chat) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Канал не найден. Убедитесь, что username указан верно и канал публичный." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (chat.type !== "channel") {
      return new Response(
        JSON.stringify({ success: false, error: "Указанный username не является каналом" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if bot is admin with posting rights
    const botMember = await getChatMember(botToken, chat.id, botId);
    const botCanPost = botMember && 
      botMember.status === "administrator" && 
      botMember.can_post_messages === true;

    if (!botCanPost) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Бот @adsingo_bot не добавлен как администратор с правом публикации. Пожалуйста, добавьте бота и выдайте право 'Публикация сообщений'.",
          botCanPost: false,
          userIsAdmin: null,
          mtprotoIsAdmin: null
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Check if VERIFIED user is admin/creator (using telegramId from initData, not from body!)
    const userMember = await getChatMember(botToken, chat.id, telegramId);
    const userIsAdmin = userMember && 
      ["creator", "administrator"].includes(userMember.status);

    if (!userIsAdmin) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Вы не являетесь администратором этого канала. Добавлять каналы могут только их владельцы или администраторы.",
          botCanPost: true,
          userIsAdmin: false,
          mtprotoIsAdmin: null
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Check if MTProto admin (@kjeuz) is added as admin for detailed analytics
    const mtprotoAdminIdStr = Deno.env.get("MTPROTO_ADMIN_TELEGRAM_ID");
    if (mtprotoAdminIdStr) {
      const mtprotoAdminId = parseInt(mtprotoAdminIdStr, 10);
      if (!isNaN(mtprotoAdminId)) {
        const mtprotoMember = await getChatMember(botToken, chat.id, mtprotoAdminId);
        const mtprotoIsAdmin = mtprotoMember && 
          ["creator", "administrator"].includes(mtprotoMember.status);

        if (!mtprotoIsAdmin) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Пользователь @kjeuz не добавлен как администратор канала. Это необходимо для получения детальной статистики.",
              botCanPost: true,
              userIsAdmin: true,
              mtprotoIsAdmin: false
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        console.log(`[verify-channel] MTProto admin @kjeuz verified for channel ${chat.id}`);
      }
    }

    // Get subscriber count
    const subscribersCount = await getChatMemberCount(botToken, chat.id);

    // Get avatar URL if available
    let avatarUrl: string | null = null;
    if (chat.photo?.big_file_id) {
      avatarUrl = await getFileUrl(botToken, chat.photo.big_file_id);
    }

    // 3. Find owner_id from users table by VERIFIED telegram_id
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ success: false, error: "Пользователь не найден. Пожалуйста, авторизуйтесь." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if channel already exists
    const { data: existingChannel } = await supabase
      .from("channels")
      .select("*")
      .eq("telegram_chat_id", chat.id)
      .maybeSingle();

    if (existingChannel) {
      // Channel exists — check if user can be added as manager
      
      // 1. Check if user is already in channel_admins
      const { data: existingAdmin } = await supabase
        .from("channel_admins")
        .select("id, role")
        .eq("channel_id", existingChannel.id)
        .eq("user_id", userData.id)
        .maybeSingle();

      if (existingAdmin) {
        return new Response(
          JSON.stringify({
            success: true,
            message: "Вы уже являетесь администратором этого канала",
            role: existingAdmin.role,
            isExistingAdmin: true,
            channel: {
              id: existingChannel.id,
              title: existingChannel.title,
              username: existingChannel.username,
              description: existingChannel.description,
              avatar_url: existingChannel.avatar_url,
              subscribers_count: existingChannel.subscribers_count,
            },
            botCanPost: true,
            userIsAdmin: true,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 2. User is confirmed admin in Telegram (userIsAdmin check was done above)
      // 3. Add as manager (or owner if they are the creator)
      const isCreator = userMember?.status === "creator";
      const role = isCreator ? "owner" : "manager";

      const { error: adminInsertError } = await supabase
        .from("channel_admins")
        .insert({
          channel_id: existingChannel.id,
          user_id: userData.id,
          role,
          telegram_member_status: userMember?.status,
          permissions: role === "owner"
            ? { can_edit_posts: true, can_view_stats: true, can_view_finance: true, can_withdraw: true, can_manage_admins: true, can_approve_ads: true }
            : { can_edit_posts: true, can_view_stats: true, can_view_finance: false, can_withdraw: false, can_manage_admins: false, can_approve_ads: true },
          last_verified_at: new Date().toISOString(),
        });

      if (adminInsertError) {
        console.error("Admin insert error for existing channel:", adminInsertError);
        return new Response(
          JSON.stringify({ success: false, error: "Ошибка добавления как администратора" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[verify-channel] User ${userData.id} added as ${role} to existing channel ${existingChannel.id}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Вы добавлены как ${role === 'owner' ? 'владелец' : 'менеджер'} канала`,
          role,
          isNewAdmin: true,
          channel: {
            id: existingChannel.id,
            title: existingChannel.title,
            username: existingChannel.username,
            description: existingChannel.description,
            avatar_url: existingChannel.avatar_url,
            subscribers_count: existingChannel.subscribers_count,
          },
          botCanPost: true,
          userIsAdmin: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Category обязательна только для новых каналов
    if (!category) {
      return new Response(
        JSON.stringify({ success: false, error: "Выберите категорию для нового канала" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Insert channel with VERIFIED owner_id
    const { data: newChannel, error: insertError } = await supabase
      .from("channels")
      .insert({
        owner_id: userData.id, // Trusted user ID from DB
        telegram_chat_id: chat.id,
        username: chat.username || username.replace("@", ""),
        title: chat.title || null,
        description: chat.description || null,
        avatar_url: avatarUrl,
        subscribers_count: subscribersCount,
        category,
        price_1_24: price_1_24 || null,
        price_2_48: price_2_48 || null,
        price_post: price_post || null,
        verified: true,
        bot_is_admin: true,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Ошибка сохранения канала в базу данных" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[verify-channel] Channel ${newChannel.id} created for user ${userData.id}`);

    // 5. Create channel_admin record for the owner
    const memberStatus = userMember?.status; // 'creator' or 'administrator'
    const isCreator = memberStatus === "creator";

    const { error: adminInsertError } = await supabase
      .from("channel_admins")
      .insert({
        channel_id: newChannel.id,
        user_id: userData.id,
        role: isCreator ? "owner" : "manager",
        telegram_member_status: memberStatus,
        permissions: isCreator
          ? { can_edit_posts: true, can_view_stats: true, can_view_finance: true, can_withdraw: true, can_manage_admins: true, can_approve_ads: true }
          : { can_edit_posts: true, can_view_stats: true, can_view_finance: false, can_withdraw: false, can_manage_admins: false, can_approve_ads: true },
        last_verified_at: new Date().toISOString(),
      });

    if (adminInsertError) {
      console.error("Channel admin insert error:", adminInsertError);
      // Non-critical - channel was created, just log the error
    } else {
      console.log(`[verify-channel] Channel admin record created: role=${isCreator ? 'owner' : 'manager'}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        channel: {
          id: newChannel.id,
          title: chat.title,
          username: chat.username || username.replace("@", ""),
          description: chat.description,
          avatar_url: avatarUrl,
          subscribers_count: subscribersCount,
        },
        botCanPost: true,
        userIsAdmin: true,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Verify channel error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Внутренняя ошибка сервера" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
