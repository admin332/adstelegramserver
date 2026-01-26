import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RefreshResponse {
  success: boolean;
  updated: boolean;
  channel?: {
    subscribers_count: number;
    description: string | null;
    title: string | null;
    avatar_url: string | null;
    stats_updated_at: string;
  };
  error?: string;
}

async function getChatMemberCount(botToken: string, chatId: number): Promise<number | null> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getChatMemberCount?chat_id=${chatId}`
    );
    const data = await response.json();
    if (data.ok) {
      return data.result;
    }
    console.error("[refresh-channel-stats] getChatMemberCount error:", data);
    return null;
  } catch (error) {
    console.error("[refresh-channel-stats] getChatMemberCount fetch error:", error);
    return null;
  }
}

async function getChat(botToken: string, chatId: number): Promise<any | null> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getChat?chat_id=${chatId}`
    );
    const data = await response.json();
    if (data.ok) {
      return data.result;
    }
    console.error("[refresh-channel-stats] getChat error:", data);
    return null;
  } catch (error) {
    console.error("[refresh-channel-stats] getChat fetch error:", error);
    return null;
  }
}

async function getFileUrl(botToken: string, fileId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    );
    const data = await response.json();
    if (data.ok && data.result?.file_path) {
      return `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;
    }
    return null;
  } catch (error) {
    console.error("[refresh-channel-stats] getFileUrl error:", error);
    return null;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { channel_id } = await req.json();

    if (!channel_id) {
      return new Response(
        JSON.stringify({ success: false, error: "channel_id is required" } as RefreshResponse),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");

    if (!botToken) {
      console.error("[refresh-channel-stats] TELEGRAM_BOT_TOKEN not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Bot token not configured" } as RefreshResponse),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Fetch channel from database
    const { data: channel, error: channelError } = await supabase
      .from("channels")
      .select("id, telegram_chat_id, stats_updated_at, title, description, subscribers_count, avatar_url")
      .eq("id", channel_id)
      .maybeSingle();

    if (channelError) {
      console.error("[refresh-channel-stats] DB error:", channelError);
      return new Response(
        JSON.stringify({ success: false, error: "Database error" } as RefreshResponse),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!channel) {
      return new Response(
        JSON.stringify({ success: false, error: "Channel not found" } as RefreshResponse),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if update is needed (24 hours threshold)
    const statsUpdatedAt = new Date(channel.stats_updated_at || 0);
    const hoursAgo = (Date.now() - statsUpdatedAt.getTime()) / (1000 * 60 * 60);

    if (hoursAgo < 24) {
      console.log(`[refresh-channel-stats] Channel ${channel_id} stats are fresh (${hoursAgo.toFixed(1)}h ago)`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          updated: false,
          channel: {
            subscribers_count: channel.subscribers_count,
            description: channel.description,
            title: channel.title,
            avatar_url: channel.avatar_url,
            stats_updated_at: channel.stats_updated_at,
          }
        } as RefreshResponse),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!channel.telegram_chat_id) {
      console.log(`[refresh-channel-stats] Channel ${channel_id} has no telegram_chat_id`);
      return new Response(
        JSON.stringify({ success: false, error: "Channel has no Telegram ID" } as RefreshResponse),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[refresh-channel-stats] Refreshing stats for channel ${channel_id} (${hoursAgo.toFixed(1)}h since last update)`);

    // Fetch fresh data from Telegram
    const [subscribersCount, chatInfo] = await Promise.all([
      getChatMemberCount(botToken, channel.telegram_chat_id),
      getChat(botToken, channel.telegram_chat_id),
    ]);

    // Get avatar URL if available
    let avatarUrl: string | null = channel.avatar_url;
    if (chatInfo?.photo?.big_file_id) {
      const newAvatarUrl = await getFileUrl(botToken, chatInfo.photo.big_file_id);
      if (newAvatarUrl) {
        avatarUrl = newAvatarUrl;
      }
    }

    // Prepare update data
    const updateData: Record<string, any> = {
      stats_updated_at: new Date().toISOString(),
    };

    if (subscribersCount !== null) {
      updateData.subscribers_count = subscribersCount;
    }

    if (chatInfo) {
      if (chatInfo.title) {
        updateData.title = chatInfo.title;
      }
      if (chatInfo.description !== undefined) {
        updateData.description = chatInfo.description || null;
      }
    }

    if (avatarUrl) {
      updateData.avatar_url = avatarUrl;
    }

    // Update channel in database
    const { error: updateError } = await supabase
      .from("channels")
      .update(updateData)
      .eq("id", channel_id);

    if (updateError) {
      console.error("[refresh-channel-stats] Update error:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to update channel" } as RefreshResponse),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[refresh-channel-stats] Successfully updated channel ${channel_id}:`, updateData);

    return new Response(
      JSON.stringify({
        success: true,
        updated: true,
        channel: {
          subscribers_count: updateData.subscribers_count ?? channel.subscribers_count,
          description: updateData.description ?? channel.description,
          title: updateData.title ?? channel.title,
          avatar_url: updateData.avatar_url ?? channel.avatar_url,
          stats_updated_at: updateData.stats_updated_at,
        },
      } as RefreshResponse),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[refresh-channel-stats] Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" } as RefreshResponse),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
