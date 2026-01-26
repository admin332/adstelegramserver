import { useQuery } from '@tanstack/react-query';
import { getTelegramInitData } from '@/lib/telegram';
import type { Database } from '@/integrations/supabase/types';

type DealStatus = Database['public']['Enums']['deal_status'];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export interface Deal {
  id: string;
  status: DealStatus;
  total_price: number;
  posts_count: number;
  duration_hours: number;
  escrow_address: string | null;
  scheduled_at: string | null;
  created_at: string;
  expires_at: string | null;
  role: 'advertiser' | 'channel_owner';
  channel: {
    id: string;
    title: string | null;
    avatar_url: string | null;
    username: string;
  } | null;
  campaign: {
    id: string;
    name: string;
    media_urls?: string[];
    image_url?: string;
  } | null;
}

export function useUserDeals() {
  return useQuery({
    queryKey: ['user-deals'],
    queryFn: async (): Promise<Deal[]> => {
      const initData = getTelegramInitData();
      if (!initData) return [];

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/user-deals`,
        {
          method: "POST",
          headers: { 
            "Content-Type": "application/json", 
            "apikey": ANON_KEY 
          },
          body: JSON.stringify({ initData }),
        }
      );

      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data.deals;
    },
  });
}
