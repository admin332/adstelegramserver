const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TelegramUpdate {
  update_id: number;
  my_chat_member?: {
    chat: {
      id: number;
      title?: string;
      username?: string;
      type: string;
    };
    from: {
      id: number;
    };
    new_chat_member: {
      status: string;
      user: {
        id: number;
        is_bot: boolean;
        username?: string;
      };
    };
    old_chat_member?: {
      status: string;
    };
  };
}

interface DetectedChannel {
  telegram_chat_id: number;
  title: string;
  username: string | null;
  avatar_url: string | null;
  subscribers_count: number;
  avg_views: number;
  engagement: number;
  recommended_price_24: number;
  recommended_price_48: number;
  has_analytics_admin: boolean;
}

// Username for analytics bot (used to check if added as admin)
const ANALYTICS_BOT_USERNAME = "kjeuz";

// CPM rates and category multipliers
const BASE_CPM_USD = 1.5; // $1.50 per 1000 views
const CATEGORY_MULTIPLIERS: Record<string, number> = {
  crypto: 1.5,
  tech: 1.5,
  business: 1.5,
  lifestyle: 1.2,
  education: 1.2,
  entertainment: 0.8,
  humor: 0.8,
};
const MIN_PRICE_TON = 1;

function validateTelegramWebAppData(initData: string, botToken: string): { valid: boolean; user?: { id: number } } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return { valid: false };

    params.delete("hash");
    const dataCheckArr: string[] = [];
    params.sort();
    params.forEach((value, key) => {
      dataCheckArr.push(`${key}=${value}`);
    });
    const dataCheckString = dataCheckArr.join("\n");

    const encoder = new TextEncoder();
    const secretKey = new Uint8Array(32);
    
    // Use Web Crypto API for HMAC
    const keyData = encoder.encode("WebAppData");
    const botTokenData = encoder.encode(botToken);
    
    // For now, we'll trust initData and just extract user
    // In production, implement full HMAC verification
    const userParam = params.get("user");
    if (userParam) {
      const user = JSON.parse(userParam);
      return { valid: true, user: { id: user.id } };
    }
    
    return { valid: false };
  } catch {
    return { valid: false };
  }
}

async function getAvatarUrl(botToken: string, chatId: number): Promise<string | null> {
  try {
    const chatResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getChat?chat_id=${chatId}`
    );
    const chatData = await chatResponse.json();
    
    if (chatData.ok && chatData.result.photo?.small_file_id) {
      const fileResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/getFile?file_id=${chatData.result.photo.small_file_id}`
      );
      const fileData = await fileResponse.json();
      
      if (fileData.ok) {
        return `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function getChannelStats(username: string): Promise<{ avgViews: number; engagement: number }> {
  try {
    // Scrape views from t.me
    const response = await fetch(`https://t.me/s/${username}`);
    const html = await response.text();
    
    // Extract views from recent posts
    const viewsMatches = html.match(/class="tgme_widget_message_views">([0-9.]+[KMБ]?)</g);
    
    if (!viewsMatches || viewsMatches.length === 0) {
      return { avgViews: 0, engagement: 0 };
    }
    
    const views: number[] = [];
    for (const match of viewsMatches.slice(0, 10)) {
      const numMatch = match.match(/>([0-9.]+)([KMБ]?)</);
      if (numMatch) {
        let value = parseFloat(numMatch[1]);
        const suffix = numMatch[2].toUpperCase();
        if (suffix === 'K' || suffix === 'К') value *= 1000;
        if (suffix === 'M' || suffix === 'М') value *= 1000000;
        views.push(value);
      }
    }
    
    const avgViews = views.length > 0 ? Math.round(views.reduce((a, b) => a + b, 0) / views.length) : 0;
    
    return { avgViews, engagement: 0 };
  } catch {
    return { avgViews: 0, engagement: 0 };
  }
}

function calculateRecommendedPrice(
  avgViews: number, 
  tonPrice: number, 
  category?: string
): { price_24: number; price_48: number } {
  if (!avgViews || !tonPrice) {
    return { price_24: MIN_PRICE_TON, price_48: MIN_PRICE_TON };
  }
  
  const multiplier = category ? (CATEGORY_MULTIPLIERS[category] || 1.0) : 1.0;
  
  // Price in USD = (avgViews / 1000) * CPM * multiplier
  const priceUsd = (avgViews / 1000) * BASE_CPM_USD * multiplier;
  
  // Convert to TON
  let priceTon = priceUsd / tonPrice;
  
  // Round to 1 decimal
  priceTon = Math.round(priceTon * 10) / 10;
  
  // Apply minimum
  priceTon = Math.max(priceTon, MIN_PRICE_TON);
  
  // 2/48 is typically 10-15% less per post
  const price48 = Math.round(priceTon * 0.9 * 10) / 10;
  
  return { 
    price_24: priceTon, 
    price_48: Math.max(price48, MIN_PRICE_TON) 
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { initData } = await req.json();
    
    if (!initData) {
      return new Response(
        JSON.stringify({ error: "Missing initData" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      throw new Error("Bot token not configured");
    }

    // Validate initData and get user
    const validation = validateTelegramWebAppData(initData, botToken);
    if (!validation.valid || !validation.user) {
      return new Response(
        JSON.stringify({ error: "Invalid initData" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userTelegramId = validation.user.id;
    console.log("Detecting channels for user:", userTelegramId);

    // Get TON price for calculating recommended price
    let tonPrice = 2.5; // fallback
    try {
      const priceResponse = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd'
      );
      const priceData = await priceResponse.json();
      tonPrice = priceData['the-open-network']?.usd || 2.5;
    } catch {
      console.log("Using fallback TON price");
    }

    // Get pending channel verifications from database (saved by webhook)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase configuration missing");
    }

    const pendingResponse = await fetch(
      `${supabaseUrl}/rest/v1/pending_channel_verifications?added_by_telegram_id=eq.${userTelegramId}&processed=eq.false&select=*`,
      {
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
        }
      }
    );
    
    if (!pendingResponse.ok) {
      console.error("Failed to fetch pending verifications:", await pendingResponse.text());
      return new Response(
        JSON.stringify({ channels: [], message: "Не удалось получить данные о каналах" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    interface PendingVerification {
      id: string;
      telegram_chat_id: number;
      chat_title: string | null;
      chat_username: string | null;
      added_by_telegram_id: number;
      bot_status: string;
      detected_at: string;
      processed: boolean;
    }

    const pendingChannels: PendingVerification[] = await pendingResponse.json();
    console.log(`Found ${pendingChannels.length} pending verifications for user ${userTelegramId}`);

    // Build potential channels map from pending verifications
    const potentialChannels = new Map<number, { title: string; username: string | null; fromUserId: number }>();
    
    for (const pending of pendingChannels) {
      potentialChannels.set(pending.telegram_chat_id, {
        title: pending.chat_title || 'Unnamed Channel',
        username: pending.chat_username || null,
        fromUserId: pending.added_by_telegram_id
      });
    }

    console.log(`Found ${potentialChannels.size} potential channels`);

    // Check each channel to see if user is also admin
    const detectedChannels: DetectedChannel[] = [];

    for (const [chatId, channelInfo] of potentialChannels) {
      try {
        // Check if user is admin in this channel
        const memberResponse = await fetch(
          `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${chatId}&user_id=${userTelegramId}`
        );
        const memberData = await memberResponse.json();

        if (!memberData.ok) {
          console.log(`User ${userTelegramId} not found in channel ${chatId}`);
          continue;
        }

        const userStatus = memberData.result.status;
        if (userStatus !== 'administrator' && userStatus !== 'creator') {
          console.log(`User ${userTelegramId} is ${userStatus} in channel ${chatId}, skipping`);
          continue;
        }

        console.log(`User ${userTelegramId} is ${userStatus} in channel ${chatId}`);

        // Check if channel already exists in DB
        if (supabaseUrl && supabaseKey) {
          const checkResponse = await fetch(
            `${supabaseUrl}/rest/v1/channels?telegram_chat_id=eq.${chatId}&select=id`,
            {
              headers: {
                "apikey": supabaseKey,
                "Authorization": `Bearer ${supabaseKey}`,
              }
            }
          );
          const existingChannels = await checkResponse.json();
          if (existingChannels && existingChannels.length > 0) {
            console.log(`Channel ${chatId} already exists in DB, skipping`);
            continue;
          }
        }

        // Get channel info and stats
        const chatInfoResponse = await fetch(
          `https://api.telegram.org/bot${botToken}/getChat?chat_id=${chatId}`
        );
        const chatInfo = await chatInfoResponse.json();

        const subscribersResponse = await fetch(
          `https://api.telegram.org/bot${botToken}/getChatMemberCount?chat_id=${chatId}`
        );
        const subscribersData = await subscribersResponse.json();
        const subscribersCount = subscribersData.ok ? subscribersData.result : 0;

        // Get avatar
        const avatarUrl = await getAvatarUrl(botToken, chatId);

        // Get view stats (only if username available)
        let stats = { avgViews: 0, engagement: 0 };
        if (channelInfo.username) {
          stats = await getChannelStats(channelInfo.username);
        }

        // Check if @kjeuz is added as admin for analytics
        let hasAnalyticsAdmin = false;
        try {
          const kjeuzResponse = await fetch(
            `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${chatId}&user_id=@${ANALYTICS_BOT_USERNAME}`
          );
          const kjeuzData = await kjeuzResponse.json();
          
          if (kjeuzData.ok) {
            const kjeuzStatus = kjeuzData.result.status;
            hasAnalyticsAdmin = kjeuzStatus === 'administrator' || kjeuzStatus === 'creator';
          }
        } catch {
          console.log(`Could not check @${ANALYTICS_BOT_USERNAME} status in channel ${chatId}`);
        }

        // Calculate recommended price
        const prices = calculateRecommendedPrice(stats.avgViews, tonPrice);

        detectedChannels.push({
          telegram_chat_id: chatId,
          title: chatInfo.result?.title || channelInfo.title,
          username: channelInfo.username,
          avatar_url: avatarUrl,
          subscribers_count: subscribersCount,
          avg_views: stats.avgViews,
          engagement: stats.engagement,
          recommended_price_24: prices.price_24,
          recommended_price_48: prices.price_48,
          has_analytics_admin: hasAnalyticsAdmin,
        });

      } catch (error) {
        console.error(`Error processing channel ${chatId}:`, error);
      }
    }

    console.log(`Detected ${detectedChannels.length} channels for user`);

    return new Response(
      JSON.stringify({ 
        channels: detectedChannels,
        tonPrice 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in detect-bot-channels:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
