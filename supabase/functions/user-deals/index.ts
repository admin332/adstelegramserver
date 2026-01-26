import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Validate Telegram initData
function validateTelegramData(initData: string, botToken: string): { valid: boolean; user?: any } {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");
    if (!hash) return { valid: false };

    urlParams.delete("hash");
    const dataCheckArr: string[] = [];
    urlParams.sort();
    urlParams.forEach((value, key) => {
      dataCheckArr.push(`${key}=${value}`);
    });
    const dataCheckString = dataCheckArr.join("\n");

    const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
    const calculatedHash = createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (calculatedHash !== hash) return { valid: false };

    const userStr = urlParams.get("user");
    if (!userStr) return { valid: false };

    return { valid: true, user: JSON.parse(userStr) };
  } catch {
    return { valid: false };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { initData } = await req.json();
    if (!initData) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing initData" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      return new Response(
        JSON.stringify({ success: false, error: "Bot token not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { valid, user: telegramUser } = validateTelegramData(initData, botToken);
    if (!valid || !telegramUser) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid initData" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find user by telegram_id
    const { data: dbUser, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", telegramUser.id)
      .maybeSingle();

    if (userError || !dbUser) {
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = dbUser.id;

    // Get channel IDs where user is admin/owner
    const { data: channelAdmins } = await supabase
      .from("channel_admins")
      .select("channel_id")
      .eq("user_id", userId);

    const userChannelIds = channelAdmins?.map((ca) => ca.channel_id) || [];

    // Fetch deals where user is advertiser OR channel owner
    let query = supabase
      .from("deals")
      .select(`
        id,
        status,
        total_price,
        posts_count,
        duration_hours,
        escrow_address,
        scheduled_at,
        created_at,
        expires_at,
        advertiser_id,
        channel_id,
        channel:channels(id, title, avatar_url, username),
        campaign:campaigns(id, name)
      `)
      .order("created_at", { ascending: false });

    // Build OR condition
    if (userChannelIds.length > 0) {
      query = query.or(`advertiser_id.eq.${userId},channel_id.in.(${userChannelIds.join(",")})`);
    } else {
      query = query.eq("advertiser_id", userId);
    }

    const { data: deals, error: dealsError } = await query;

    if (dealsError) {
      console.error("Error fetching deals:", dealsError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch deals" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Collect advertiser IDs for channel owner deals
    const advertiserIds = new Set<string>();
    deals?.forEach((deal) => {
      if (userChannelIds.includes(deal.channel_id) && deal.advertiser_id !== userId) {
        advertiserIds.add(deal.advertiser_id);
      }
    });

    // Fetch advertiser info
    let advertisersMap: Record<string, any> = {};
    if (advertiserIds.size > 0) {
      const { data: advertisers } = await supabase
        .from("users")
        .select("id, first_name, username, photo_url")
        .in("id", Array.from(advertiserIds));

      advertisers?.forEach((adv) => {
        advertisersMap[adv.id] = adv;
      });
    }

    // Transform deals with role info
    const transformedDeals = deals?.map((deal) => {
      const isChannelOwner = userChannelIds.includes(deal.channel_id) && deal.advertiser_id !== userId;
      const role = isChannelOwner ? "channel_owner" : "advertiser";

      return {
        id: deal.id,
        status: deal.status,
        total_price: deal.total_price,
        posts_count: deal.posts_count,
        duration_hours: deal.duration_hours,
        escrow_address: deal.escrow_address,
        scheduled_at: deal.scheduled_at,
        created_at: deal.created_at,
        expires_at: deal.expires_at,
        channel: deal.channel,
        campaign: deal.campaign,
        role,
        advertiser: isChannelOwner ? advertisersMap[deal.advertiser_id] : undefined,
      };
    }) || [];

    return new Response(
      JSON.stringify({ success: true, deals: transformedDeals }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in user-deals:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
