import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

async function fetchTonPrice(): Promise<number> {
  const { data, error } = await supabase.functions.invoke('ton-price');
  if (error || !data?.price) {
    throw new Error('Не удалось получить курс TON');
  }
  return data.price;
}

export function useTonPrice() {
  const { data: tonPrice, isLoading: loading } = useQuery({
    queryKey: ['ton-price'],
    queryFn: fetchTonPrice,
    staleTime: 5 * 60 * 1000,      // Данные свежие 5 минут
    gcTime: 10 * 60 * 1000,        // Кеш хранится 10 минут
    refetchInterval: 5 * 60 * 1000, // Автообновление каждые 5 минут
    retry: 2,
  });

  const convertToUsd = (tonAmount: number): number | null => {
    if (!tonPrice) return null;
    return tonAmount * tonPrice;
  };

  return { tonPrice: tonPrice ?? null, loading, convertToUsd };
}
