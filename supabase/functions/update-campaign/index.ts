import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function validateTelegramInitData(initData: string, botToken: string): { valid: boolean; user?: { id: number } } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return { valid: false };
    
    params.delete("hash");
    const dataCheckArr: string[] = [];
    params.forEach((value, key) => {
      dataCheckArr.push(`${key}=${value}`);
    });
    dataCheckArr.sort();
    const dataCheckString = dataCheckArr.join("\n");
    
    const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
    const calculatedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
    
    if (calculatedHash !== hash) return { valid: false };
    
    const userStr = params.get("user");
    if (!userStr) return { valid: false };
    
    const user = JSON.parse(userStr);
    return { valid: true, user: { id: user.id } };
  } catch {
    return { valid: false };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      campaign_id, 
      initData,
      name,
      campaign_type,
      text,
      button_text,
      button_url,
      media_urls
    } = await req.json();

    if (!campaign_id || !initData) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing campaign_id or initData" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      return new Response(
        JSON.stringify({ success: false, error: "Bot token not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const validation = validateTelegramInitData(initData, botToken);
    if (!validation.valid || !validation.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid initData" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", validation.user.id)
      .single();

    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Verify campaign ownership
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("id, owner_id")
      .eq("id", campaign_id)
      .single();

    if (!campaign || campaign.owner_id !== user.id) {
      return new Response(
        JSON.stringify({ success: false, error: "Campaign not found or access denied" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // Check for active deals before updating
    const { data: activeDeals } = await supabase
      .from("deals")
      .select("id")
      .eq("campaign_id", campaign_id)
      .in("status", ["pending", "escrow", "in_progress"]);

    if (activeDeals && activeDeals.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Кампания используется в активных сделках и не может быть изменена" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Update campaign
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (campaign_type !== undefined) updateData.campaign_type = campaign_type;
    if (text !== undefined) updateData.text = text;
    if (button_text !== undefined) updateData.button_text = button_text;
    if (button_url !== undefined) updateData.button_url = button_url;
    if (media_urls !== undefined) {
      updateData.media_urls = media_urls;
      updateData.image_url = media_urls[0] || null;
    }

    const { error: updateError } = await supabase
      .from("campaigns")
      .update(updateData)
      .eq("id", campaign_id);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to update campaign" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log(`[update-campaign] Updated campaign ${campaign_id} for user ${user.id}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
