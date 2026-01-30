import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Parse views text like "15.2K" → 15200, "1.5M" → 1500000
function parseViewsText(text: string): number {
  const cleaned = text.trim().replace(/\s/g, "");
  const num = parseFloat(cleaned.replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return 0;
  if (cleaned.toUpperCase().includes("K")) return Math.round(num * 1000);
  if (cleaned.toUpperCase().includes("M")) return Math.round(num * 1000000);
  return Math.round(num);
}

// Fetch views for a single post from t.me embed
async function fetchPostViews(
  username: string,
  messageId: number
): Promise<{ views: number; date: string | null } | null> {
  try {
    const url = `https://t.me/${username}/${messageId}?embed=1`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; StatsBot/1.0)",
      },
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Parse views: <span class="tgme_widget_message_views">15.2K</span>
    const viewsMatch = html.match(/tgme_widget_message_views[^>]*>([^<]+)</);
    // Parse date: datetime="2026-01-26T12:00:00+00:00"
    const dateMatch = html.match(/datetime="([^"]+)"/);
    
    if (!viewsMatch) return null;
    
    const views = parseViewsText(viewsMatch[1]);
    const date = dateMatch ? dateMatch[1].split("T")[0] : null;
    
    return { views, date };
  } catch (error) {
    console.error(`[refresh] Failed to fetch post ${messageId}:`, error);
    return null;
  }
}

// Find the latest message ID by parsing the channel's public page
async function findLatestMessageId(username: string): Promise<number | null> {
  try {
    const response = await fetch(`https://t.me/s/${username}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; StatsBot/1.0)",
      },
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Find post IDs in HTML: data-post="username/123"
    const matches = [...html.matchAll(/data-post="[^/]+\/(\d+)"/g)];
    const ids = matches.map((m) => parseInt(m[1]));
    
    if (ids.length > 0) {
      return Math.max(...ids);
    }
    return null;
  } catch (error) {
    console.error(`[refresh] Failed to find latest message for ${username}:`, error);
    return null;
  }
}

// Collect stats for the last N posts
async function collectRecentPostsStats(
  username: string,
  startMessageId: number,
  maxPosts: number = 10
): Promise<{ messageId: number; views: number; date: string }[]> {
  const stats: { messageId: number; views: number; date: string }[] = [];
  
  // Try up to 30 message IDs to find 10 valid posts (some may be deleted/service messages)
  for (let i = 0; i < 30 && stats.length < maxPosts; i++) {
    const msgId = startMessageId - i;
    if (msgId <= 0) break;
    
    const postData = await fetchPostViews(username, msgId);
    if (postData && postData.views > 0) {
      stats.push({
        messageId: msgId,
        views: postData.views,
        date: postData.date || new Date().toISOString().split("T")[0],
      });
    }
    
    // Small delay to avoid rate limiting
    if (i > 0 && i % 5 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  
  return stats;
}

// Calculate average views and engagement rate
function calculateMetrics(
  subscribersCount: number,
  recentPosts: { views: number }[]
): { avgViews: number; engagement: number } {
  if (recentPosts.length === 0) {
    return { avgViews: 0, engagement: 0 };
  }
  
  const totalViews = recentPosts.reduce((sum, p) => sum + p.views, 0);
  const avgViews = Math.round(totalViews / recentPosts.length);
  
  // ER = (Average Views / Subscribers) × 100%
  const engagement =
    subscribersCount > 0
      ? Math.round((avgViews / subscribersCount) * 100 * 10) / 10
      : 0;
  
  return { avgViews, engagement };
}

// Get subscriber count via Bot API
async function getSubscriberCount(
  botToken: string,
  chatId: number
): Promise<number | null> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getChatMemberCount?chat_id=${chatId}`
    );
    const data = await response.json();
    
    if (data.ok) {
      return data.result;
    }
    console.error("[refresh] getChatMemberCount failed:", data);
    return null;
  } catch (error) {
    console.error("[refresh] getChatMemberCount error:", error);
    return null;
  }
}

// Get channel info via Bot API
async function getChatInfo(
  botToken: string,
  chatId: number
): Promise<{
  title?: string;
  description?: string;
  photoFileId?: string;
} | null> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getChat?chat_id=${chatId}`
    );
    const data = await response.json();
    
    if (data.ok) {
      return {
        title: data.result.title,
        description: data.result.description,
        photoFileId: data.result.photo?.big_file_id,
      };
    }
    console.error("[refresh] getChat failed:", data);
    return null;
  } catch (error) {
    console.error("[refresh] getChat error:", error);
    return null;
  }
}

// Get file URL from Telegram
async function getFileUrl(
  botToken: string,
  fileId: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    );
    const data = await response.json();
    
    if (data.ok && data.result.file_path) {
      return `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;
    }
    return null;
  } catch (error) {
    console.error("[refresh] getFile error:", error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { channel_id } = await req.json();
    
    if (!channel_id) {
      return new Response(
        JSON.stringify({ success: false, error: "channel_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch channel from database
    const { data: channel, error: fetchError } = await supabase
      .from("channels")
      .select("*")
      .eq("id", channel_id)
      .maybeSingle();

    if (fetchError || !channel) {
      console.error("[refresh] Channel not found:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: "Channel not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if stats are fresh (less than 24 hours old)
    const statsUpdatedAt = new Date(channel.stats_updated_at || 0);
    const hoursAgo = (Date.now() - statsUpdatedAt.getTime()) / (1000 * 60 * 60);
    
    if (hoursAgo < 24) {
      console.log(`[refresh] Stats are ${hoursAgo.toFixed(1)}h old, skipping update`);
      return new Response(
        JSON.stringify({ success: true, updated: false, reason: "Stats are fresh" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[refresh] Updating stats for channel @${channel.username}`);

    // Get subscriber count from Bot API (if we have telegram_chat_id)
    let subscribersCount = channel.subscribers_count || 0;
    let title = channel.title;
    let description = channel.description;
    let avatarUrl = channel.avatar_url;
    
    if (channel.telegram_chat_id) {
      const newCount = await getSubscriberCount(botToken, channel.telegram_chat_id);
      if (newCount !== null) {
        subscribersCount = newCount;
      }
      
      const chatInfo = await getChatInfo(botToken, channel.telegram_chat_id);
      if (chatInfo) {
        title = chatInfo.title || title;
        description = chatInfo.description || description;
        
        if (chatInfo.photoFileId) {
          const photoUrl = await getFileUrl(botToken, chatInfo.photoFileId);
          if (photoUrl) {
            avatarUrl = photoUrl;
          }
        }
      }
    }

    // Scrape recent posts stats from t.me
    let recentPostsStats: { messageId: number; views: number; date: string }[] = [];
    let avgViews = channel.avg_views || 0;
    let engagement = channel.engagement || 0;

    // MTProto extended stats
    let languageStats = channel.language_stats || null;
    let growthRate = channel.growth_rate || null;
    let notificationsEnabled = channel.notifications_enabled || null;
    let topHours = channel.top_hours || null;

    if (channel.username) {
      const latestMsgId = await findLatestMessageId(channel.username);
      
      if (latestMsgId) {
        console.log(`[refresh] Found latest message ID: ${latestMsgId}`);
        recentPostsStats = await collectRecentPostsStats(channel.username, latestMsgId);
        console.log(`[refresh] Collected ${recentPostsStats.length} post stats`);
        
        const metrics = calculateMetrics(subscribersCount, recentPostsStats);
        avgViews = metrics.avgViews;
        engagement = metrics.engagement;
      } else {
        console.log(`[refresh] Could not find latest message ID for @${channel.username}`);
      }

      // Try to get extended stats via MTProto (for channels with 500+ subscribers)
      // Note: MTProto requires VPS deployment, so this may return setupRequired: true
      if (subscribersCount >= 500) {
        try {
          console.log(`[refresh] Fetching MTProto stats for @${channel.username}`);
          
          const mtprotoResponse = await fetch(
            `${supabaseUrl}/functions/v1/mtproto-channel-stats`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username: channel.username }),
            }
          );
          
          const mtprotoData = await mtprotoResponse.json();
          
          if (mtprotoData.success) {
            console.log(`[refresh] MTProto stats received`);
            
            // Update subscribers from MTProto if available (more accurate)
            if (mtprotoData.channel?.participantsCount) {
              subscribersCount = mtprotoData.channel.participantsCount;
            }
            
            if (mtprotoData.stats) {
              // === ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ RAW ДАННЫХ ===
              console.log(`[refresh] RAW languageStats:`, JSON.stringify(mtprotoData.stats.languageStats));
              console.log(`[refresh] RAW topHours:`, JSON.stringify(mtprotoData.stats.topHours));
              console.log(`[refresh] RAW stats keys:`, Object.keys(mtprotoData.stats));
              
              if (mtprotoData.stats.topHours?.length > 0) {
                const firstItem = mtprotoData.stats.topHours[0];
                console.log(`[refresh] topHours[0] keys:`, Object.keys(firstItem));
                console.log(`[refresh] topHours[0] full:`, JSON.stringify(firstItem));
              }
              // === КОНЕЦ ЛОГИРОВАНИЯ ===
              
              // Languages: { label, value } → { language, percentage }
              if (mtprotoData.stats.languageStats?.length > 0) {
                const total = mtprotoData.stats.languageStats.reduce((s: number, l: { value?: number }) => s + (l.value || 0), 0);
                languageStats = mtprotoData.stats.languageStats.map((l: { label?: string; value?: number }) => ({
                  language: l.label || 'Unknown',
                  percentage: total > 0 ? Math.round((l.value || 0) / total * 100) : 0
                }));
                console.log(`[refresh] Got ${languageStats.length} language entries`);
              }
              
              // Growth rate: теперь напрямую
              if (mtprotoData.stats.growthRate !== undefined) {
                growthRate = mtprotoData.stats.growthRate;
                console.log(`[refresh] Growth rate: ${growthRate}%`);
              }
              
              // Notifications: part/total → percentage
              if (mtprotoData.stats.notificationsRaw) {
                const { part, total } = mtprotoData.stats.notificationsRaw;
                notificationsEnabled = total > 0 ? Math.round((part / total) * 10000) / 100 : 0;
                console.log(`[refresh] Notifications enabled: ${notificationsEnabled}%`);
              }
              
              // Top hours: { x, [label]: value } → { hour, value } (динамические ключи)
              if (mtprotoData.stats.topHours?.length > 0) {
                topHours = mtprotoData.stats.topHours.map((h: Record<string, unknown>, idx: number) => {
                  const valueKey = Object.keys(h).find(k => k !== 'x');
                  const value = valueKey ? (Number(h[valueKey]) || 0) : 0;
                  return { hour: idx, value };
                });
                console.log(`[refresh] Got top hours data`);
              }
            }
          } else if (mtprotoData.setupRequired) {
            console.log(`[refresh] MTProto VPS not configured, skipping extended stats`);
          } else {
            console.log(`[refresh] MTProto stats failed: ${mtprotoData.error}`);
          }
        } catch (e) {
          console.error("[refresh] MTProto stats error:", e);
        }
      }
    }

    // Update channel in database with all stats including MTProto data
    const updateData: Record<string, any> = {
      subscribers_count: subscribersCount,
      avg_views: avgViews,
      engagement: engagement,
      title: title,
      description: description,
      avatar_url: avatarUrl,
      recent_posts_stats: recentPostsStats,
      stats_updated_at: new Date().toISOString(),
    };

    // Add MTProto stats if available
    if (languageStats !== null) {
      updateData.language_stats = languageStats;
    }
    if (growthRate !== null) {
      updateData.growth_rate = growthRate;
    }
    if (notificationsEnabled !== null) {
      updateData.notifications_enabled = notificationsEnabled;
    }
    if (topHours !== null) {
      updateData.top_hours = topHours;
    }

    const { error: updateError } = await supabase
      .from("channels")
      .update(updateData)
      .eq("id", channel_id);

    if (updateError) {
      console.error("[refresh] Update error:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to update channel" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[refresh] Successfully updated stats for @${channel.username}`);

    return new Response(
      JSON.stringify({
        success: true,
        updated: true,
        channel: {
          subscribers_count: subscribersCount,
          avg_views: avgViews,
          engagement: engagement,
          recent_posts_stats: recentPostsStats,
          language_stats: languageStats,
          growth_rate: growthRate,
          notifications_enabled: notificationsEnabled,
          top_hours: topHours,
          stats_updated_at: new Date().toISOString(),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[refresh] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
