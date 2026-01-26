import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Channel } from '@/data/mockChannels';

interface DatabaseChannel {
  id: string;
  title: string | null;
  username: string;
  avatar_url: string | null;
  subscribers_count: number | null;
  avg_views: number | null;
  category: string;
  price_1_24: number | null;
  price_2_48: number | null;
  rating: number | null;
  verified: boolean | null;
  is_premium: boolean | null;
  description: string | null;
  engagement: number | null;
  successful_ads: number | null;
  is_active: boolean | null;
}

function mapDatabaseToChannel(dbChannel: DatabaseChannel): Channel {
  const tonPrice = Number(dbChannel.price_1_24) || 0;
  const usdPrice = Math.round(tonPrice * 3.5); // Approximate USD conversion
  
  return {
    id: dbChannel.id,
    name: dbChannel.title || dbChannel.username,
    username: dbChannel.username,
    avatar: dbChannel.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(dbChannel.title || dbChannel.username)}&background=random`,
    subscribers: dbChannel.subscribers_count || 0,
    avgViews: dbChannel.avg_views || Math.round((dbChannel.subscribers_count || 0) * 0.35),
    category: dbChannel.category,
    price: usdPrice,
    tonPrice: tonPrice,
    rating: Number(dbChannel.rating) || 4.5,
    verified: dbChannel.verified || false,
    premium: dbChannel.is_premium || false,
    description: dbChannel.description || undefined,
    engagement: Number(dbChannel.engagement) || 35,
    successfulAds: dbChannel.successful_ads || 0,
  };
}

export function useChannels() {
  return useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .eq('is_active', true)
        .eq('verified', true)
        .order('subscribers_count', { ascending: false });

      if (error) {
        console.error('Error fetching channels:', error);
        throw error;
      }

      return (data || []).map(mapDatabaseToChannel);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useChannel(id: string | undefined) {
  return useQuery({
    queryKey: ['channel', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching channel:', error);
        throw error;
      }

      if (!data) return null;

      return mapDatabaseToChannel(data);
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
}
