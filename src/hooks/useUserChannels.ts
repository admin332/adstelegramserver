import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { getTelegramInitData } from "@/lib/telegram";

export interface UserChannel {
  id: string;
  username: string;
  title: string | null;
  description: string | null;
  avatar_url: string | null;
  subscribers_count: number | null;
  category: string;
  is_active: boolean | null;
  verified: boolean | null;
  price_1_24: number | null;
  price_2_48: number | null;
  created_at: string | null;
  userRole?: 'owner' | 'manager';
}

export function useUserChannels() {
  return useQuery({
    queryKey: ["user-channels"],
    queryFn: async (): Promise<UserChannel[]> => {
      const initData = getTelegramInitData();
      
      if (!initData) {
        console.log("[useUserChannels] No initData available");
        return [];
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/user-channels`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ initData }),
        }
      );

      const data = await response.json();
      
      if (!data.success) {
        console.error("[useUserChannels] Error:", data.error);
        throw new Error(data.error || "Failed to fetch channels");
      }

      return data.channels as UserChannel[];
    },
    staleTime: 30000, // 30 seconds
  });
}

export function useToggleChannelActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ channelId, isActive }: { channelId: string; isActive: boolean }) => {
      const initData = getTelegramInitData();
      
      if (!initData) {
        throw new Error("Telegram data not available");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-channel-status`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            channel_id: channelId,
            is_active: isActive,
            initData,
          }),
        }
      );

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to update channel");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-channels"] });
      toast({
        title: "Статус обновлён",
        description: "Изменения сохранены",
      });
    },
    onError: (error) => {
      console.error("Toggle channel error:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось обновить статус канала",
        variant: "destructive",
      });
    },
  });
}
