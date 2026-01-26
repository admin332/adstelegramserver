import React, { useState } from 'react';
import { Copy, ExternalLink, CheckCircle, Loader2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTonWallet } from '@/hooks/useTonWallet';
import { useTonPrice } from '@/hooks/useTonPrice';
import { toast } from 'sonner';
import tonIcon from '@/assets/ton-icon.svg';

interface PaymentStepProps {
  totalPriceTon: number;
  escrowAddress: string | null;
  isCreatingDeal: boolean;
  onPaymentComplete: () => void;
}

const PaymentStep: React.FC<PaymentStepProps> = ({
  totalPriceTon,
  escrowAddress,
  isCreatingDeal,
  onPaymentComplete,
}) => {
  const { address: walletAddress, isConnected, connect } = useTonWallet();
  const { tonPrice, convertToUsd } = useTonPrice();
  const [copied, setCopied] = useState(false);

  const usdEquivalent = convertToUsd(totalPriceTon);

  const copyAddress = async () => {
    if (!escrowAddress) return;
    
    try {
      await navigator.clipboard.writeText(escrowAddress);
      setCopied(true);
      toast.success('Адрес скопирован');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Не удалось скопировать');
    }
  };

  const openExplorer = () => {
    if (!escrowAddress) return;
    window.open(`https://tonviewer.com/${escrowAddress}`, '_blank');
  };

  // Если кошелёк не подключён
  if (!isConnected) {
    return (
      <div className="space-y-6 text-center">
        <div className="bg-secondary/50 rounded-2xl p-6">
          <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Подключите кошелёк</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Для оплаты необходимо подключить TON кошелёк
          </p>
          <Button onClick={connect} className="w-full">
            Подключить кошелёк
          </Button>
        </div>
      </div>
    );
  }

  // Если сделка ещё создаётся
  if (isCreatingDeal || !escrowAddress) {
    return (
      <div className="space-y-6 text-center py-8">
        <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
        <div>
          <h3 className="text-lg font-semibold mb-2">Создаём сделку...</h3>
          <p className="text-sm text-muted-foreground">
            Генерируем уникальный эскроу-адрес для вашей сделки
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Сумма к оплате */}
      <div className="bg-primary/10 rounded-2xl p-5 text-center">
        <p className="text-sm text-muted-foreground mb-1">К оплате</p>
        <div className="flex items-center justify-center gap-2">
          <img src={tonIcon} alt="TON" className="w-8 h-8" />
          <span className="text-3xl font-bold">{totalPriceTon} TON</span>
        </div>
        {usdEquivalent && (
          <p className="text-sm text-muted-foreground mt-1">≈ ${usdEquivalent}</p>
        )}
      </div>

      {/* Эскроу адрес */}
      <div className="bg-secondary/50 rounded-2xl p-4">
        <p className="text-sm text-muted-foreground mb-2 text-center">
          Отправьте средства на адрес эскроу:
        </p>
        
        <div className="bg-background rounded-xl p-3 flex items-center gap-2">
          <code className="flex-1 text-sm font-mono truncate">
            {escrowAddress}
          </code>
          <Button
            variant="ghost"
            size="icon"
            onClick={copyAddress}
            className="shrink-0"
          >
            {copied ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <Copy className="w-5 h-5" />
            )}
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={openExplorer}
          className="w-full mt-2 text-muted-foreground"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Открыть в эксплорере
        </Button>
      </div>

      {/* Информация о кошельке пользователя */}
      <div className="bg-secondary/30 rounded-xl p-3 text-center">
        <p className="text-xs text-muted-foreground">Ваш кошелёк</p>
        <p className="font-mono text-sm">
          {walletAddress?.slice(0, 8)}...{walletAddress?.slice(-6)}
        </p>
      </div>

      {/* Предупреждение */}
      <div className="text-center text-sm text-muted-foreground">
        <p>
          После оплаты средства будут заморожены до выполнения заказа.
          Это защищает обе стороны сделки.
        </p>
      </div>

      {/* Кнопка подтверждения */}
      <Button onClick={onPaymentComplete} className="w-full h-12 text-base font-semibold">
        Я оплатил
      </Button>
    </div>
  );
};

export default PaymentStep;
