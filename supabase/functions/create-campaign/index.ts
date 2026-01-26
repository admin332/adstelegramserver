import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateCampaignRequest {
  user_id: string;
  name: string;
  text: string;
  button_text?: string;
  button_url?: string;
  image_url?: string; // Legacy field for backward compatibility
  media_urls?: string[]; // New field for multiple media
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CreateCampaignRequest = await req.json();
    const { user_id, name, text, button_text, button_url, image_url, media_urls } = body;

    if (!user_id || !name || !text) {
      return new Response(
        JSON.stringify({ success: false, error: "Не все обязательные поля заполнены" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user exists
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("id", user_id)
      .maybeSingle();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ success: false, error: "Пользователь не найден" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle media URLs: prefer new media_urls array, fallback to legacy image_url
    let finalMediaUrls: string[] = [];
    if (media_urls && media_urls.length > 0) {
      finalMediaUrls = media_urls;
    } else if (image_url) {
      finalMediaUrls = [image_url];
    }

    // Create campaign
    const { data: campaign, error: insertError } = await supabase
      .from("campaigns")
      .insert({
        owner_id: user_id,
        name,
        text,
        button_text: button_text || null,
        button_url: button_url || null,
        image_url: finalMediaUrls[0] || null, // Keep legacy field populated
        media_urls: finalMediaUrls, // New JSONB array
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Ошибка создания кампании" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        campaign: {
          id: campaign.id,
          name: campaign.name,
          text: campaign.text,
          button_text: campaign.button_text,
          button_url: campaign.button_url,
          image_url: campaign.image_url,
          media_urls: campaign.media_urls,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Create campaign error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Внутренняя ошибка сервера" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
