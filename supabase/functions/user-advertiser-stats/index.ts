import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function validateTelegramInitData(initData: string): { valid: boolean; user?: { id: number } } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return { valid: false };

    params.delete("hash");
    const dataCheckArr = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`);
    const dataCheckString = dataCheckArr.join("\n");

    const secretKey = createHmac("sha256", "WebAppData").update(TELEGRAM_BOT_TOKEN).digest();
    const calculatedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    if (calculatedHash !== hash) return { valid: false };

    const userStr = params.get("user");
    if (!userStr) return { valid: false };

    const user = JSON.parse(userStr);
    return { valid: true, user };
  } catch {
    return { valid: false };
  }
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

    const validation = validateTelegramInitData(initData);
    if (!validation.valid || !validation.user) {
      return new Response(
        JSON.stringify({ error: "Invalid initData" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const telegramId = validation.user.id;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get user by telegram_id
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ completed_deals: 0, avg_rating: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Get user's channels (as owner or manager)
    const { data: channelAdmins } = await supabase
      .from("channel_admins")
      .select("channel_id")
      .eq("user_id", user.id);

    const userChannelIds = channelAdmins?.map((ca) => ca.channel_id) || [];

    // 2. Count completed deals as ADVERTISER
    const { count: advertiserDeals } = await supabase
      .from("deals")
      .select("*", { count: "exact", head: true })
      .eq("advertiser_id", user.id)
      .eq("status", "completed");

    // 3. Count completed deals as CHANNEL OWNER (exclude duplicates where user is also advertiser)
    let ownerDeals = 0;
    if (userChannelIds.length > 0) {
      const { count } = await supabase
        .from("deals")
        .select("*", { count: "exact", head: true })
        .in("channel_id", userChannelIds)
        .neq("advertiser_id", user.id)
        .eq("status", "completed");
      ownerDeals = count || 0;
    }

    // 4. Total deals = advertiser + owner
    const completedDeals = (advertiserDeals || 0) + ownerDeals;

    // 5. Get turnover as ADVERTISER (expenses)
    const { data: advertiserDealsData } = await supabase
      .from("deals")
      .select("total_price")
      .eq("advertiser_id", user.id)
      .eq("status", "completed");

    let advertiserTurnover = 0;
    if (advertiserDealsData && advertiserDealsData.length > 0) {
      advertiserTurnover = advertiserDealsData.reduce((acc, d) => acc + (Number(d.total_price) || 0), 0);
    }

    // 6. Get turnover as CHANNEL OWNER (income)
    let ownerTurnover = 0;
    if (userChannelIds.length > 0) {
      const { data: ownerDealsData } = await supabase
        .from("deals")
        .select("total_price")
        .in("channel_id", userChannelIds)
        .neq("advertiser_id", user.id)
        .eq("status", "completed");

      if (ownerDealsData && ownerDealsData.length > 0) {
        ownerTurnover = ownerDealsData.reduce((acc, d) => acc + (Number(d.total_price) || 0), 0);
      }
    }

    // 7. Total turnover = expenses + income
    const totalTurnover = advertiserTurnover + ownerTurnover;

    // 8. Get average rating from advertiser_reviews
    const { data: advertiserReviews } = await supabase
      .from("advertiser_reviews")
      .select("rating")
      .eq("advertiser_id", user.id);

    // 9. Get average rating from channel reviews (for user's channels)
    let channelReviews: { rating: number }[] = [];
    if (userChannelIds.length > 0) {
      const { data: reviews } = await supabase
        .from("reviews")
        .select("rating")
        .in("channel_id", userChannelIds);
      channelReviews = reviews || [];
    }

    // 10. Combine ratings from both roles
    const allRatings = [
      ...(advertiserReviews || []).map(r => r.rating),
      ...channelReviews.map(r => r.rating)
    ];

    let avgRating = 0;
    if (allRatings.length > 0) {
      const sum = allRatings.reduce((acc, r) => acc + r, 0);
      avgRating = Math.round((sum / allRatings.length) * 10) / 10;
    }

    return new Response(
      JSON.stringify({
        completed_deals: completedDeals,
        avg_rating: avgRating,
        total_turnover: totalTurnover,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
