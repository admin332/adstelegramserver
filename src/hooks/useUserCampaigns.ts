import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { getTelegramInitData } from "@/lib/telegram";

export interface UserCampaign {
  id: string;
  name: string;
  text: string;
  button_text: string | null;
  button_url: string | null;
  image_url: string | null;
  media_urls: string[] | null;
  is_active: boolean | null;
  created_at: string | null;
  campaign_type: string;
}

export function useUserCampaigns() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-campaigns", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching user campaigns:", error);
        throw error;
      }

      return data as UserCampaign[];
    },
    enabled: !!user?.id,
  });
}

export function useToggleCampaignActive() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ campaignId, isActive }: { campaignId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("campaigns")
        .update({ is_active: isActive })
        .eq("id", campaignId)
        .eq("owner_id", user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-campaigns"] });
      toast({
        title: "Статус обновлён",
        description: "Изменения сохранены",
      });
    },
    onError: (error) => {
      console.error("Toggle campaign error:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось обновить статус кампании",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      // Get initData for secure authentication
      const initData = getTelegramInitData();
      
      if (!initData) {
        throw new Error("Требуется авторизация через Telegram");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-campaign`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            campaign_id: campaignId,
            initData, // Secure: send initData instead of user_id
          }),
        }
      );

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Ошибка удаления");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-campaigns"] });
      toast({
        title: "Кампания удалена",
        description: "Кампания успешно удалена",
      });
    },
    onError: (error) => {
      console.error("Delete campaign error:", error);
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось удалить кампанию",
        variant: "destructive",
      });
    },
  });
}
