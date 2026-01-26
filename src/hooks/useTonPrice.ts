import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useTonPrice() {
  const [tonPrice, setTonPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('ton-price');
        if (!error && data?.price) {
          setTonPrice(data.price);
        }
      } catch (e) {
        console.error('Ошибка получения курса TON:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchPrice();
    
    // Обновлять каждые 5 минут
    const interval = setInterval(fetchPrice, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const convertToUsd = (tonAmount: number): number | null => {
    if (!tonPrice) return null;
    return tonAmount * tonPrice;
  };

  return { tonPrice, loading, convertToUsd };
}
