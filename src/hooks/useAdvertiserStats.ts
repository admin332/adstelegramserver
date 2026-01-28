import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AdvertiserStats {
  completedDeals: number;
  avgRating: number;
}

export function useAdvertiserStats() {
  const [stats, setStats] = useState<AdvertiserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const initData = window.Telegram?.WebApp?.initData;
        
        if (!initData) {
          // No Telegram context - return zeros
          setStats({ completedDeals: 0, avgRating: 0 });
          setIsLoading(false);
          return;
        }

        const { data, error: fnError } = await supabase.functions.invoke(
          "user-advertiser-stats",
          {
            body: { initData },
          }
        );

        if (fnError) {
          throw fnError;
        }

        setStats({
          completedDeals: data?.completed_deals ?? 0,
          avgRating: data?.avg_rating ?? 0,
        });
      } catch (err) {
        console.error("Failed to fetch advertiser stats:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setStats({ completedDeals: 0, avgRating: 0 });
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, isLoading, error };
}
