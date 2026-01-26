import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer: {
    first_name: string;
    photo_url: string | null;
  } | null;
}

export function useChannelReviews(channelId: string | undefined) {
  return useQuery({
    queryKey: ['channel-reviews', channelId],
    queryFn: async (): Promise<Review[]> => {
      if (!channelId) return [];

      const { data, error } = await supabase
        .from('reviews')
        .select(`
          id,
          rating,
          comment,
          created_at,
          reviewer:reviewer_id(first_name, photo_url)
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching reviews:', error);
        throw error;
      }

      return (data || []).map((item) => ({
        id: item.id,
        rating: item.rating,
        comment: item.comment,
        created_at: item.created_at,
        reviewer: item.reviewer as Review['reviewer'],
      }));
    },
    enabled: !!channelId,
    staleTime: 1000 * 60 * 5,
  });
}
