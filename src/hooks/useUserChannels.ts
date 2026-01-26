import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

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
}

export function useUserChannels() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-channels", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("channels")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching user channels:", error);
        throw error;
      }

      return data as UserChannel[];
    },
    enabled: !!user?.id,
  });
}

export function useToggleChannelActive() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ channelId, isActive }: { channelId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("channels")
        .update({ is_active: isActive })
        .eq("id", channelId)
        .eq("owner_id", user?.id);

      if (error) throw error;
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
