import React from 'react';
import { TonConnectButton } from '@tonconnect/ui-react';
import { CheckCircle } from 'lucide-react';
import { useTonWallet } from '@/hooks/useTonWallet';
import tonIcon from '@/assets/ton-icon.svg';

const WalletSection: React.FC = () => {
  const { address, isConnected, isSaving } = useTonWallet();

  return (
    <div className="bg-card rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <img src={tonIcon} alt="TON" className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">TON Кошелёк</h3>
          {isConnected && (
            <div className="flex items-center gap-1 text-xs text-green-500">
              <CheckCircle className="w-3 h-3" />
              <span>Подключён</span>
            </div>
          )}
        </div>
      </div>

      {isConnected ? (
        <div className="space-y-3">
          <div className="flex justify-center">
            <TonConnectButton />
          </div>
          
          {isSaving && (
            <p className="text-xs text-center text-muted-foreground">
              Сохранение...
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground text-center">
            Подключите кошелёк для оплаты рекламы и получения выплат
          </p>
          <div className="flex justify-center">
            <TonConnectButton />
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletSection;
