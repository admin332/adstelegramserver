import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TestModeValue {
  enabled: boolean;
}

export function useAppSettings() {
  const [testModeEnabled, setTestModeEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTestMode = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'test_mode')
        .maybeSingle();
      
      if (!error && data?.value) {
        const value = data.value as unknown as TestModeValue;
        setTestModeEnabled(value.enabled ?? false);
      }
    } catch (err) {
      console.error('Error fetching app settings:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateTestMode = useCallback(async (enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ 
          value: { enabled },
          updated_at: new Date().toISOString() 
        })
        .eq('key', 'test_mode');
      
      if (!error) {
        setTestModeEnabled(enabled);
        return { error: null };
      }
      return { error };
    } catch (err) {
      console.error('Error updating test mode:', err);
      return { error: err };
    }
  }, []);

  useEffect(() => {
    fetchTestMode();
  }, [fetchTestMode]);

  return { testModeEnabled, isLoading, updateTestMode, refetch: fetchTestMode };
}
