import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type DealStatus = Database['public']['Enums']['deal_status'];

export interface Deal {
  id: string;
  status: DealStatus;
  total_price: number;
  posts_count: number;
  duration_hours: number;
  escrow_address: string | null;
  scheduled_at: string | null;
  created_at: string;
  channel: {
    id: string;
    title: string | null;
    avatar_url: string | null;
    username: string;
  } | null;
  campaign: {
    id: string;
    name: string;
  } | null;
}

export function useUserDeals() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['user-deals', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('deals')
        .select(`
          id,
          status,
          total_price,
          posts_count,
          duration_hours,
          escrow_address,
          scheduled_at,
          created_at,
          channel:channels(id, title, avatar_url, username),
          campaign:campaigns(id, name)
        `)
        .eq('advertiser_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Deal[];
    },
    enabled: !!user?.id,
  });
}
