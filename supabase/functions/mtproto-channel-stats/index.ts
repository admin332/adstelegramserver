// MTProto channel stats - placeholder for VPS integration
// NOTE: Full MTProto implementation requires VPS deployment due to Supabase Edge Function limitations

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username } = await req.json();
    
    if (!username) {
      return new Response(
        JSON.stringify({ success: false, error: "username is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if VPS URL is configured
    const vpsUrl = Deno.env.get("MTPROTO_VPS_URL");
    const vpsSecret = Deno.env.get("MTPROTO_VPS_SECRET");

    if (vpsUrl && vpsSecret) {
      // Proxy request to VPS with MTProto implementation
      try {
        console.log(`[mtproto] Proxying request to VPS for @${username}`);
        
        const response = await fetch(`${vpsUrl}/stats/${username}`, {
          method: "GET",
          headers: {
            "X-API-Key": vpsSecret,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`VPS returned ${response.status}`);
        }

        const data = await response.json();
        
        return new Response(
          JSON.stringify(data),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e: any) {
        console.error("[mtproto] VPS request failed:", e);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `VPS connection failed: ${e.message}`,
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // No VPS configured - return info about setup
    console.log("[mtproto] VPS not configured, returning placeholder");
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "MTProto VPS not configured",
        message: "MTProto requires a VPS deployment due to Supabase Edge Function limitations. Set MTPROTO_VPS_URL and MTPROTO_VPS_SECRET secrets to enable.",
        setupRequired: true,
      }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[mtproto] Error:", error);

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
