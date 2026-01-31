import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getTelegramInitData } from '@/lib/telegram';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Fetch favorites from database
async function fetchFavoritesFromDB(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('favorites')
    .select('channel_id')
    .eq('user_id', userId);
  
  if (error) {
    console.error('Error fetching favorites:', error);
    return [];
  }
  
  return data?.map(f => f.channel_id) || [];
}

// Toggle favorite via edge function
async function toggleFavoriteInDB(channelId: string, action: 'add' | 'remove'): Promise<boolean> {
  const initData = getTelegramInitData();
  
  if (!initData) {
    throw new Error('Telegram auth required');
  }
  
  const response = await fetch(`${SUPABASE_URL}/functions/v1/toggle-favorite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel_id: channelId,
      action,
      init_data: initData,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to toggle favorite');
  }
  
  const result = await response.json();
  return result.isFavorite;
}

// Sync localStorage favorites to database
async function syncLocalFavoritesToDB(userId: string, localFavorites: string[]): Promise<void> {
  if (localFavorites.length === 0) return;
  
  const initData = getTelegramInitData();
  if (!initData) return;
  
  console.log('Syncing local favorites to DB:', localFavorites);
  
  // Add each favorite to DB
  for (const channelId of localFavorites) {
    try {
      await toggleFavoriteInDB(channelId, 'add');
    } catch (error) {
      console.error(`Failed to sync favorite ${channelId}:`, error);
    }
  }
  
  // Clear localStorage after sync
  localStorage.removeItem('favoriteChannels');
}

export const useFavorites = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Local state for unauthenticated users
  const [localFavorites, setLocalFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('favoriteChannels');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Fetch favorites from DB for authenticated users
  const { data: dbFavorites = [], isLoading } = useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: () => fetchFavoritesFromDB(user!.id),
    enabled: !!user?.id,
    staleTime: 30000, // 30 seconds
  });

  // Sync localStorage to DB on first login
  useEffect(() => {
    if (user?.id && localFavorites.length > 0) {
      syncLocalFavoritesToDB(user.id, localFavorites).then(() => {
        // Refetch from DB after sync
        queryClient.invalidateQueries({ queryKey: ['favorites', user.id] });
        setLocalFavorites([]);
      });
    }
  }, [user?.id, localFavorites.length, queryClient]);

  // Save local favorites to localStorage
  useEffect(() => {
    if (!user) {
      localStorage.setItem('favoriteChannels', JSON.stringify(localFavorites));
    }
  }, [localFavorites, user]);

  // Mutation for toggling favorites in DB
  const toggleMutation = useMutation({
    mutationFn: async (channelId: string) => {
      const currentFavorites = dbFavorites;
      const isFav = currentFavorites.includes(channelId);
      const action = isFav ? 'remove' : 'add';
      return { channelId, isFavorite: await toggleFavoriteInDB(channelId, action) };
    },
    onMutate: async (channelId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['favorites', user?.id] });
      
      // Snapshot previous value
      const previousFavorites = queryClient.getQueryData<string[]>(['favorites', user?.id]) || [];
      
      // Optimistic update
      const isFav = previousFavorites.includes(channelId);
      const newFavorites = isFav
        ? previousFavorites.filter(id => id !== channelId)
        : [...previousFavorites, channelId];
      
      queryClient.setQueryData(['favorites', user?.id], newFavorites);
      
      return { previousFavorites };
    },
    onError: (_error, _channelId, context) => {
      // Rollback on error
      if (context?.previousFavorites) {
        queryClient.setQueryData(['favorites', user?.id], context.previousFavorites);
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['favorites', user?.id] });
    },
  });

  // Toggle function for local storage
  const toggleLocal = useCallback((channelId: string) => {
    setLocalFavorites(prev => 
      prev.includes(channelId) 
        ? prev.filter(id => id !== channelId)
        : [...prev, channelId]
    );
  }, []);

  // Combined toggle function
  const toggleFavorite = useCallback((channelId: string) => {
    if (user?.id) {
      toggleMutation.mutate(channelId);
    } else {
      toggleLocal(channelId);
    }
  }, [user?.id, toggleMutation, toggleLocal]);

  // Get current favorites
  const favorites = user?.id ? dbFavorites : localFavorites;

  // Check if channel is favorite
  const isFavorite = useCallback((channelId: string) => {
    return favorites.includes(channelId);
  }, [favorites]);

  return { 
    favorites, 
    toggleFavorite, 
    isFavorite,
    isLoading: user?.id ? isLoading : false,
  };
};
