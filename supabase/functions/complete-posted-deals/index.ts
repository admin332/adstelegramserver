import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface Deal {
  id: string;
  posted_at: string;
  duration_hours: number;
  total_price: number;
  channel: {
    title: string | null;
    username: string;
    owner_id: string;
  };
  advertiser_id: string;
}

interface User {
  telegram_id: number | null;
  wallet_address: string | null;
}

async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
        }),
      }
    );
    const result = await response.json();
    if (!result.ok) {
      console.error("Telegram send error:", result);
    }
  } catch (error) {
    console.error("Failed to send Telegram message:", error);
  }
}

async function processDeal(deal: Deal): Promise<{ success: boolean; error?: string }> {
  console.log(`Processing deal ${deal.id} for completion...`);

  try {
    const channelTitle = deal.channel.title || deal.channel.username;

    // Get advertiser data
    const { data: advertiser } = await supabase
      .from("users")
      .select("telegram_id, wallet_address")
      .eq("id", deal.advertiser_id)
      .single();

    // Get channel owner data
    const { data: owner } = await supabase
      .from("users")
      .select("telegram_id, wallet_address")
      .eq("id", deal.channel.owner_id)
      .single();

    // Update deal status to completed
    const { error: updateError } = await supabase
      .from("deals")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", deal.id);

    if (updateError) {
      throw new Error(`Failed to update deal: ${updateError.message}`);
    }

    // Notify advertiser
    if (advertiser?.telegram_id) {
      const durationText = deal.duration_hours < 24 
        ? `${deal.duration_hours}ч` 
        : `${Math.floor(deal.duration_hours / 24)}д`;
      
      await sendTelegramMessage(
        advertiser.telegram_id,
        `✅ <b>Размещение завершено!</b>

Ваша реклама в канале <b>${channelTitle}</b> (@${deal.channel.username}) успешно отработала полный срок (${durationText}).

Средства переведены владельцу канала.
Спасибо за использование Adsingo! 🚀`
      );
    }

    // Notify channel owner
    if (owner?.telegram_id) {
      await sendTelegramMessage(
        owner.telegram_id,
        `💰 <b>Сделка завершена!</b>

Реклама в канале <b>${channelTitle}</b> успешно отработала.
Сумма: <b>${deal.total_price} TON</b>

Средства скоро будут переведены на ваш кошелёк.`
      );
    }

    console.log(`Deal ${deal.id} completed successfully`);
    return { success: true };
  } catch (error) {
    console.error(`Error processing deal ${deal.id}:`, error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("Checking for posted deals ready for completion...");

  try {
    // Get all in_progress deals where posted_at is set
    const { data: deals, error: dealsError } = await supabase
      .from("deals")
      .select(`
        id, posted_at, duration_hours, total_price, advertiser_id,
        channel:channels(title, username, owner_id)
      `)
      .eq("status", "in_progress")
      .not("posted_at", "is", null);

    if (dealsError) {
      throw new Error(`Failed to fetch deals: ${dealsError.message}`);
    }

    if (!deals || deals.length === 0) {
      console.log("No posted deals found");
      return new Response(
        JSON.stringify({ success: true, message: "No deals to complete", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${deals.length} posted deals to check`);

    const now = new Date();
    const dealsToComplete: Deal[] = [];

    for (const deal of deals) {
      if (!deal.posted_at) continue;
      
      const channel = Array.isArray(deal.channel) ? deal.channel[0] : deal.channel;
      if (!channel) continue;

      const postedAt = new Date(deal.posted_at);
      const completionTime = new Date(postedAt.getTime() + deal.duration_hours * 60 * 60 * 1000);

      if (now >= completionTime) {
        dealsToComplete.push({
          id: deal.id,
          posted_at: deal.posted_at,
          duration_hours: deal.duration_hours,
          total_price: deal.total_price,
          advertiser_id: deal.advertiser_id,
          channel: channel as Deal["channel"],
        });
      }
    }

    if (dealsToComplete.length === 0) {
      console.log("No deals ready for completion yet");
      return new Response(
        JSON.stringify({ success: true, message: "No deals ready for completion", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`${dealsToComplete.length} deals ready for completion`);

    // Process each deal
    const results = await Promise.all(dealsToComplete.map(processDeal));

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Completed: ${successful}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: dealsToComplete.length,
        successful,
        failed,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in complete-posted-deals:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
