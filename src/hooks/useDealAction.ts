import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getTelegramInitData } from '@/lib/telegram';
import { toast } from 'sonner';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type DealAction = 'approve' | 'reject' | 'request_changes';

interface DealActionParams {
  dealId: string;
  action: DealAction;
}

export function useDealAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealId, action }: DealActionParams) => {
      const initData = getTelegramInitData();
      if (!initData) throw new Error('Not authenticated');

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/deal-action`,
        {
          method: "POST",
          headers: { 
            "Content-Type": "application/json", 
            "apikey": ANON_KEY 
          },
          body: JSON.stringify({ initData, dealId, action }),
        }
      );

      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['user-deals'] });
      
      const messages: Record<DealAction, string> = {
        approve: 'Сделка одобрена',
        reject: 'Сделка отклонена',
        request_changes: 'Запрос на изменения отправлен',
      };
      
      toast.success(messages[action]);
    },
    onError: (error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });
}
