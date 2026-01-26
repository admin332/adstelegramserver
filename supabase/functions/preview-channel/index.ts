import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const body = await req.json();
    const { username } = body;

    if (!username || typeof username !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Username is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format channel username
    const chatId = username.startsWith("@") ? username : `@${username}`;

    // Get channel info
    const chat = await getChat(botToken, chatId);
    if (!chat) {
      return new Response(
        JSON.stringify({ success: false, error: "Channel not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (chat.type !== "channel") {
      return new Response(
        JSON.stringify({ success: false, error: "Not a channel" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get avatar URL if available
    let avatarUrl: string | null = null;
    if (chat.photo?.big_file_id) {
      avatarUrl = await getFileUrl(botToken, chat.photo.big_file_id);
    }

    // Check if channel already exists in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    let exists = false;
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const cleanUsername = (chat.username || username.replace("@", "")).toLowerCase();
      
      const { data: existingChannel } = await supabase
        .from("channels")
        .select("id")
        .ilike("username", cleanUsername)
        .maybeSingle();
      
      exists = !!existingChannel;
    }

    return new Response(
      JSON.stringify({
        success: true,
        title: chat.title || null,
        username: chat.username || username.replace("@", ""),
        avatar_url: avatarUrl,
        exists,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Preview channel error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Internal server error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
