import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-channels", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Получаем записи из channel_admins для текущего пользователя
      const { data: adminEntries, error: adminError } = await supabase
        .from("channel_admins")
        .select("channel_id, role")
        .eq("user_id", user.id);

      if (adminError) {
        console.error("Error fetching admin entries:", adminError);
        throw adminError;
      }

      if (!adminEntries || adminEntries.length === 0) return [];

      const channelIds = adminEntries.map(e => e.channel_id);

      // Получаем каналы по ID
      const { data: channels, error: channelsError } = await supabase
        .from("channels")
        .select("*")
        .in("id", channelIds)
        .order("created_at", { ascending: false });

      if (channelsError) {
        console.error("Error fetching channels:", channelsError);
        throw channelsError;
      }

      // Добавляем роль к каждому каналу
      return (channels || []).map(ch => ({
        ...ch,
        userRole: adminEntries.find(e => e.channel_id === ch.id)?.role as 'owner' | 'manager' | undefined,
      })) as UserChannel[];
    },
    enabled: !!user?.id,
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
