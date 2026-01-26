import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyChannelRequest {
  username: string;
  telegram_user_id: number;
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
    const { username, telegram_user_id, category, price_1_24, price_2_48, price_post } = body;

    if (!username || !telegram_user_id || !category) {
      return new Response(
        JSON.stringify({ success: false, error: "Не все обязательные поля заполнены" }),
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
          userIsAdmin: null
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin/creator
    const userMember = await getChatMember(botToken, chat.id, telegram_user_id);
    const userIsAdmin = userMember && 
      ["creator", "administrator"].includes(userMember.status);

    if (!userIsAdmin) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Вы не являетесь администратором этого канала. Добавлять каналы могут только их владельцы или администраторы.",
          botCanPost: true,
          userIsAdmin: false
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get subscriber count
    const subscribersCount = await getChatMemberCount(botToken, chat.id);

    // Get avatar URL if available
    let avatarUrl: string | null = null;
    if (chat.photo?.big_file_id) {
      avatarUrl = await getFileUrl(botToken, chat.photo.big_file_id);
    }

    // Find owner_id from users table
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", telegram_user_id)
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
      .select("id")
      .eq("telegram_chat_id", chat.id)
      .maybeSingle();

    if (existingChannel) {
      return new Response(
        JSON.stringify({ success: false, error: "Этот канал уже зарегистрирован в системе" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert channel into database
    const { data: newChannel, error: insertError } = await supabase
      .from("channels")
      .insert({
        owner_id: userData.id,
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
