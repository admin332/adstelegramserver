import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { getTelegramInitData } from "@/lib/telegram";

export interface ChannelStats {
  favorites_count: number;
  completed_deals_count: number;
}

export interface ChannelSettings {
  price_1_24: number | null;
  price_2_48: number | null;
  accepted_campaign_types: string;
  min_hours_before_post: number;
  auto_delete_posts: boolean;
}

export interface ChannelStatsResponse {
  stats: ChannelStats;
  settings: ChannelSettings;
}

export function useChannelStats(channelId: string | null) {
  return useQuery({
    queryKey: ["channel-stats", channelId],
    queryFn: async (): Promise<ChannelStatsResponse> => {
      if (!channelId) throw new Error("No channel ID");
      
      const initData = getTelegramInitData();
      if (!initData) throw new Error("No Telegram data");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/channel-stats-for-owner`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ initData, channel_id: channelId }),
        }
      );

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch stats");
      }

      return {
        stats: data.stats,
        settings: data.settings,
      };
    },
    enabled: !!channelId,
    staleTime: 30000,
  });
}

export function useUpdateChannelSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      channelId,
      settings,
    }: {
      channelId: string;
      settings: Partial<ChannelSettings>;
    }) => {
      const initData = getTelegramInitData();
      if (!initData) throw new Error("No Telegram data");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-channel-settings`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            initData,
            channel_id: channelId,
            settings,
          }),
        }
      );

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "Failed to update settings");
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["channel-stats", variables.channelId] });
      queryClient.invalidateQueries({ queryKey: ["user-channels"] });
      toast({
        title: "Настройки сохранены",
        description: "Изменения применены",
      });
    },
    onError: (error) => {
      console.error("Update settings error:", error);
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось сохранить настройки",
        variant: "destructive",
      });
    },
  });
}
