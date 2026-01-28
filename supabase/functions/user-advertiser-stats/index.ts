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

    // Count completed deals where user is advertiser
    const { count: completedDeals } = await supabase
      .from("deals")
      .select("*", { count: "exact", head: true })
      .eq("advertiser_id", user.id)
      .eq("status", "completed");

    // Get average rating from advertiser_reviews
    const { data: reviews } = await supabase
      .from("advertiser_reviews")
      .select("rating")
      .eq("advertiser_id", user.id);

    let avgRating = 0;
    if (reviews && reviews.length > 0) {
      const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
      avgRating = Math.round((sum / reviews.length) * 10) / 10;
    }

    // Get total turnover from completed deals
    const { data: dealsData } = await supabase
      .from("deals")
      .select("total_price")
      .eq("advertiser_id", user.id)
      .eq("status", "completed");

    let totalTurnover = 0;
    if (dealsData && dealsData.length > 0) {
      totalTurnover = dealsData.reduce((acc, d) => acc + (Number(d.total_price) || 0), 0);
    }

    return new Response(
      JSON.stringify({
        completed_deals: completedDeals || 0,
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
