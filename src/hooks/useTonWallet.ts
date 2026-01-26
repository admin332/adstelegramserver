import { useTonAddress, useTonConnectModal, useTonConnectUI } from '@tonconnect/ui-react';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getTelegramInitData } from '@/lib/telegram';

export function useTonWallet() {
  const address = useTonAddress();
  const { open } = useTonConnectModal();
  const [tonConnectUI] = useTonConnectUI();
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [savedAddress, setSavedAddress] = useState<string | null>(null);

  const saveToDatabase = useCallback(async (walletAddress: string) => {
    if (!user?.id || isSaving) return;
    
    // Не сохраняем, если адрес уже сохранён
    if (savedAddress === walletAddress) return;
    
    setIsSaving(true);
    try {
      const initData = getTelegramInitData();
      
      const { error } = await supabase.functions.invoke('save-wallet', {
        body: { 
          walletAddress,
          initData
        }
      });
      
      if (error) {
        console.error('Error saving wallet:', error);
      } else {
        setSavedAddress(walletAddress);
      }
    } catch (err) {
      console.error('Error saving wallet:', err);
    } finally {
      setIsSaving(false);
    }
  }, [user?.id, isSaving, savedAddress]);

  // Автосохранение при изменении адреса
  useEffect(() => {
    if (address && address !== savedAddress) {
      saveToDatabase(address);
    }
  }, [address, savedAddress, saveToDatabase]);

  const disconnect = useCallback(async () => {
    await tonConnectUI.disconnect();
    setSavedAddress(null);
  }, [tonConnectUI]);

  return {
    address,
    isConnected: !!address,
    isSaving,
    connect: open,
    disconnect,
    saveToDatabase,
  };
}
