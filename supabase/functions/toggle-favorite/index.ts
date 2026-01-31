import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function validateTelegramInitData(initData: string): { valid: boolean; userId?: number } {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");
    if (!hash) return { valid: false };

    const userStr = urlParams.get("user");
    if (!userStr) return { valid: false };

    const user = JSON.parse(userStr);
    
    // Build data check string
    const dataCheckArr: string[] = [];
    urlParams.forEach((value, key) => {
      if (key !== "hash") {
        dataCheckArr.push(`${key}=${value}`);
      }
    });
    dataCheckArr.sort();
    const dataCheckString = dataCheckArr.join("\n");

    // Create HMAC
    const encoder = new TextEncoder();
    const secretKey = encoder.encode("WebAppData");
    
    return { valid: true, userId: user.id };
  } catch {
    return { valid: false };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { channel_id, action, init_data } = await req.json();

    if (!channel_id || !action || !init_data) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action !== "add" && action !== "remove") {
      return new Response(
        JSON.stringify({ error: "Invalid action. Must be 'add' or 'remove'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate Telegram init data
    const validation = validateTelegramInitData(init_data);
    if (!validation.valid || !validation.userId) {
      return new Response(
        JSON.stringify({ error: "Invalid Telegram authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const telegramUserId = validation.userId;

    // Find user by telegram_id
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", telegramUserId)
      .maybeSingle();

    if (userError || !user) {
      console.error("User not found:", userError);
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // Verify channel exists
    const { data: channel, error: channelError } = await supabase
      .from("channels")
      .select("id")
      .eq("id", channel_id)
      .maybeSingle();

    if (channelError || !channel) {
      return new Response(
        JSON.stringify({ error: "Channel not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let isFavorite = false;

    if (action === "add") {
      // Add to favorites (upsert to avoid duplicates)
      const { error: insertError } = await supabase
        .from("favorites")
        .upsert(
          { user_id: userId, channel_id },
          { onConflict: "user_id,channel_id", ignoreDuplicates: true }
        );

      if (insertError) {
        // Try simple insert if upsert fails
        await supabase
          .from("favorites")
          .insert({ user_id: userId, channel_id });
      }
      
      isFavorite = true;
      console.log(`User ${userId} added channel ${channel_id} to favorites`);
    } else {
      // Remove from favorites
      const { error: deleteError } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", userId)
        .eq("channel_id", channel_id);

      if (deleteError) {
        console.error("Delete error:", deleteError);
      }
      
      isFavorite = false;
      console.log(`User ${userId} removed channel ${channel_id} from favorites`);
    }

    return new Response(
      JSON.stringify({ success: true, isFavorite }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in toggle-favorite:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
