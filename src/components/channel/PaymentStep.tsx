import React, { useState } from 'react';
import { Copy, ExternalLink, CheckCircle, Loader2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTonWallet } from '@/hooks/useTonWallet';
import { useTonPrice } from '@/hooks/useTonPrice';
import { useTonConnectUI } from '@tonconnect/ui-react';
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
  const { isConnected, connect } = useTonWallet();
  const { convertToUsd } = useTonPrice();
  const [tonConnectUI] = useTonConnectUI();
  const [copied, setCopied] = useState(false);
  const [isPaying, setIsPaying] = useState(false);

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

  // Открывает ссылку кошелька — СИНХРОННО, в рамках клика
  const openWalletLink = (url: string) => {
    // Для TMA используем openLink (для внешних HTTPS ссылок), не openTelegramLink!
    if (window.Telegram?.WebApp?.openLink) {
      window.Telegram.WebApp.openLink(url);
    } else {
      window.location.href = url;
    }
  };

  // Получает universal link из подключённого кошелька СИНХРОННО
  const getConnectedWalletLink = (): string | null => {
    const wallet = tonConnectUI.wallet;
    // walletInfo содержит universalLink для подключённого кошелька
    const walletInfo = (wallet as any)?.walletInfo;
    return walletInfo?.universalLink || null;
  };

  const handlePayViaWallet = () => {
    if (!escrowAddress) return;
    
    setIsPaying(true);
    
    // 1. Конвертация TON в nanoTON
    const amountNano = Math.floor(totalPriceTon * 1_000_000_000).toString();
    
    const transaction = {
      validUntil: Math.floor(Date.now() / 1000) + 600,
      messages: [
        {
          address: escrowAddress,
          amount: amountNano,
        },
      ],
    };
    
    // 2. СИНХРОННО получаем ссылку кошелька (без await!)
    const walletLink = getConnectedWalletLink();
    
    // 3. Отправляем транзакцию (без await — чтобы не терять user gesture)
    tonConnectUI.sendTransaction(transaction, {
      modals: ['success', 'error'],
      notifications: ['before', 'success', 'error'],
      returnStrategy: 'tg://resolve',
      twaReturnUrl: 'https://t.me/adsingo_bot/open',
    }).catch((error: any) => {
      console.error('[TonConnect] sendTransaction error:', error);
      
      const errorMessage = error?.message || '';
      if (errorMessage.includes('Interrupted') || errorMessage.includes('cancelled')) {
        toast.error('Оплата отменена');
      } else if (errorMessage.includes('timeout') || errorMessage.includes('bridge')) {
        toast.error('Кошелёк не отвечает. Попробуйте ещё раз.');
      } else {
        toast.error('Не удалось выполнить оплату. Попробуйте ещё раз.');
      }
    }).finally(() => {
      setIsPaying(false);
    });
    
    // 4. СРАЗУ открываем кошелёк (в контексте клика!)
    if (walletLink) {
      openWalletLink(walletLink);
      toast.success('Открываем кошелёк...');
    } else {
      toast.error('Не удалось получить ссылку кошелька. Переподключите кошелёк.');
      setIsPaying(false);
    }
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
          Временный адрес эскроу
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

      {/* Предупреждение */}
      <div className="text-center text-sm text-muted-foreground">
        <p>
          После оплаты средства будут заморожены до выполнения заказа.
          Это защищает обе стороны сделки.
        </p>
      </div>

      {/* Кнопка оплаты через кошелёк */}
      <Button 
        onClick={handlePayViaWallet} 
        className="w-full h-12 text-base font-semibold"
        disabled={isPaying}
      >
        {isPaying ? (
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        ) : (
          <Wallet className="w-5 h-5 mr-2" />
        )}
        Оплатить
      </Button>

    </div>
  );
};

export default PaymentStep;
