import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Channel } from '@/data/mockChannels';
import type { Json } from '@/integrations/supabase/types';

interface PostStatRaw {
  messageId: number;
  views: number;
  date: string;
}

interface LanguageStatRaw {
  language: string;
  percentage: number;
}

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
  stats_updated_at: string | null;
  recent_posts_stats: Json | null;
  language_stats: Json | null;
  premium_percentage: number | null;
}

function parseRecentPostsStats(data: Json | null): PostStatRaw[] {
  if (!data || !Array.isArray(data)) return [];
  const result: PostStatRaw[] = [];
  for (const item of data) {
    if (
      typeof item === 'object' && 
      item !== null && 
      'messageId' in item && 
      'views' in item && 
      'date' in item
    ) {
      result.push({
        messageId: Number((item as Record<string, unknown>).messageId),
        views: Number((item as Record<string, unknown>).views),
        date: String((item as Record<string, unknown>).date),
      });
    }
  }
  return result;
}

function parseLanguageStats(data: Json | null): LanguageStatRaw[] | undefined {
  if (!data || !Array.isArray(data)) return undefined;
  const result: LanguageStatRaw[] = [];
  for (const item of data) {
    if (
      typeof item === 'object' && 
      item !== null && 
      'language' in item && 
      'percentage' in item
    ) {
      result.push({
        language: String((item as Record<string, unknown>).language),
        percentage: Number((item as Record<string, unknown>).percentage),
      });
    }
  }
  return result.length > 0 ? result : undefined;
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
    statsUpdatedAt: dbChannel.stats_updated_at || undefined,
    recentPostsStats: parseRecentPostsStats(dbChannel.recent_posts_stats),
    languageStats: parseLanguageStats(dbChannel.language_stats),
    premiumPercentage: dbChannel.premium_percentage ?? undefined,
  };
}

async function refreshChannelStats(channelId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refresh-channel-stats`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: channelId }),
      }
    );
    const data = await response.json();
    console.log('[useChannel] Refresh stats response:', data);
    return data.updated === true;
  } catch (error) {
    console.error('[useChannel] Failed to refresh channel stats:', error);
    return false;
  }
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
  const queryClient = useQueryClient();
  const refreshingRef = useRef(false);
  
  const channelQuery = useQuery({
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

  // Effect to check and refresh stats if older than 24 hours
  useEffect(() => {
    if (!channelQuery.data || !id || refreshingRef.current) return;
    
    const statsUpdatedAt = new Date(channelQuery.data.statsUpdatedAt || 0);
    const hoursAgo = (Date.now() - statsUpdatedAt.getTime()) / (1000 * 60 * 60);
    
    if (hoursAgo > 24) {
      console.log(`[useChannel] Stats are ${hoursAgo.toFixed(1)}h old, refreshing...`);
      refreshingRef.current = true;
      
      refreshChannelStats(id).then((updated) => {
        refreshingRef.current = false;
        if (updated) {
          console.log('[useChannel] Stats updated, invalidating query');
          queryClient.invalidateQueries({ queryKey: ['channel', id] });
          queryClient.invalidateQueries({ queryKey: ['channels'] });
        }
      });
    }
  }, [channelQuery.data, id, queryClient]);

  return channelQuery;
}
