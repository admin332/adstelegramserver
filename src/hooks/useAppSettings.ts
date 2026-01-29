import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SettingValue {
  enabled: boolean;
}

export function useAppSettings() {
  const [testModeEnabled, setTestModeEnabled] = useState(false);
  const [stickerEnabled, setStickerEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['test_mode', 'animated_sticker']);
      
      if (!error && data) {
        data.forEach(setting => {
          const value = setting.value as unknown as SettingValue;
          if (setting.key === 'test_mode') {
            setTestModeEnabled(value.enabled ?? false);
          } else if (setting.key === 'animated_sticker') {
            setStickerEnabled(value.enabled ?? true);
          }
        });
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

  const updateStickerEnabled = useCallback(async (enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ 
          value: { enabled },
          updated_at: new Date().toISOString() 
        })
        .eq('key', 'animated_sticker');
      
      if (!error) {
        setStickerEnabled(enabled);
        return { error: null };
      }
      return { error };
    } catch (err) {
      console.error('Error updating sticker setting:', err);
      return { error: err };
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return { 
    testModeEnabled, 
    stickerEnabled,
    isLoading, 
    updateTestMode, 
    updateStickerEnabled,
    refetch: fetchSettings 
  };
}
