import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTonConnectUI } from "@tonconnect/ui-react";
import { ExternalLink, Copy, Check, Wallet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTonPrice } from "@/hooks/useTonPrice";
import { ExpirationTimer } from "@/components/deals/ExpirationTimer";
import TonIcon from "@/assets/ton-icon.svg";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  totalPrice: number;
  escrowAddress: string | null;
  expiresAt: string | null;
  channelName: string;
  onPaymentSuccess?: () => void;
}

export function PaymentDialog({
  open,
  onOpenChange,
  dealId,
  totalPrice,
  escrowAddress,
  expiresAt,
  channelName,
  onPaymentSuccess,
}: PaymentDialogProps) {
  const navigate = useNavigate();
  const [tonConnectUI] = useTonConnectUI();
  const [copied, setCopied] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const { convertToUsd } = useTonPrice();

  const usdEquivalent = convertToUsd(totalPrice);

  const handleCopyAddress = async () => {
    if (!escrowAddress) return;
    
    try {
      await navigator.clipboard.writeText(escrowAddress);
      setCopied(true);
      toast.success("Адрес скопирован");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Не удалось скопировать");
    }
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
    if (!wallet) return null;
    
    // universalLink находится прямо на ConnectedWallet (не во вложенном walletInfo)
    const link = (wallet as any).universalLink;
    console.log('[TonConnect] wallet:', wallet);
    console.log('[TonConnect] universalLink:', link);
    
    return link || null;
  };

  const handlePayViaWallet = () => {
    if (!escrowAddress) {
      toast.error("Адрес эскроу не найден");
      return;
    }

    if (!tonConnectUI.connected) {
      toast.error("Сначала подключите кошелёк в профиле");
      return;
    }

    setIsPaying(true);
    
    // ВАЖНО: Сохраняем в localStorage СРАЗУ, ДО отправки транзакции
    // Это нужно для TMA, где Promise может не resolve'иться после возврата из кошелька
    try {
      const pendingPayments = JSON.parse(localStorage.getItem('pending_payments') || '[]');
      if (!pendingPayments.includes(dealId)) {
        pendingPayments.push(dealId);
        localStorage.setItem('pending_payments', JSON.stringify(pendingPayments));
      }
    } catch {}
    
    const wallet = tonConnectUI.wallet;
    
    // Telegram Wallet определяется по appName устройства
    const isTelegramWallet = wallet?.device?.appName?.toLowerCase().includes('telegram');
    
    // Также проверяем injected как fallback для других встроенных кошельков
    const isInjectedWallet = wallet?.provider === 'injected';
    
    // Для встроенных кошельков (Telegram Wallet, injected) — не нужно открывать внешнюю ссылку
    const isEmbeddedWallet = isTelegramWallet || isInjectedWallet;
    
    console.log('[TonConnect] wallet:', wallet);
    console.log('[TonConnect] device.appName:', wallet?.device?.appName);
    console.log('[TonConnect] provider:', wallet?.provider);
    console.log('[TonConnect] isEmbeddedWallet:', isEmbeddedWallet);
    
    // 1. Конвертация TON в nanoTON
    const amountNano = Math.floor(totalPrice * 1_000_000_000).toString();
    
    const transaction = {
      validUntil: Math.floor(Date.now() / 1000) + 600,
      messages: [
        {
          address: escrowAddress,
          amount: amountNano,
        },
      ],
    };
    
    // 2. Получаем ссылку только для внешних кошельков
    const walletLink = isEmbeddedWallet ? null : getConnectedWalletLink();
    
    // 3. Отправляем транзакцию (без await — чтобы не терять user gesture)
    tonConnectUI.sendTransaction(transaction, {
      modals: ['success', 'error'],
      notifications: ['before', 'success', 'error'],
      returnStrategy: 'tg://resolve',
      twaReturnUrl: 'https://t.me/adsingo_bot/open',
      // onRequestSent вызывается сразу после отправки транзакции в кошелёк
      onRequestSent: () => {
        console.log('[TonConnect] onRequestSent triggered');
        
        // dealId уже сохранён в localStorage выше
        // Закрываем диалог и перенаправляем
        onOpenChange(false);
        onPaymentSuccess?.();
        navigate('/deals');
        toast.success("Транзакция отправлена! Проверяем оплату...");
      }
    }).then(() => {
      // Fallback если onRequestSent не сработал
      onOpenChange(false);
      onPaymentSuccess?.();
      navigate('/deals');
    }).catch((error: any) => {
      console.error('[TonConnect] sendTransaction error:', error);
      
      // Удаляем из localStorage при ошибке
      try {
        const pendingPayments = JSON.parse(localStorage.getItem('pending_payments') || '[]');
        const updated = pendingPayments.filter((pid: string) => pid !== dealId);
        localStorage.setItem('pending_payments', JSON.stringify(updated));
      } catch {}
      
      const errorMessage = error?.message || '';
      if (errorMessage.includes('Interrupted') || errorMessage.includes('cancelled')) {
        toast.error("Оплата отменена");
      } else if (errorMessage.includes('timeout') || errorMessage.includes('bridge')) {
        toast.error("Кошелёк не отвечает. Попробуйте ещё раз.");
      } else {
        toast.error("Не удалось выполнить оплату. Попробуйте ещё раз.");
      }
    }).finally(() => {
      setIsPaying(false);
    });
    
    // 4. Открываем кошелёк только если это внешний (http) кошелёк
    if (walletLink) {
      openWalletLink(walletLink);
      // Для внешних кошельков — редирект сразу, т.к. Promise может не resolve'иться
      setTimeout(() => {
        onOpenChange(false);
        navigate('/deals');
      }, 1000);
    } else if (isEmbeddedWallet) {
      // Для Telegram Wallet и injected кошельков — ничего делать не нужно
      // Модальное окно откроется автоматически внутри Telegram
      toast.success("Подтвердите транзакцию в кошельке");
    } else {
      toast.error("Не удалось получить ссылку кошелька. Переподключите кошелёк.");
      setIsPaying(false);
      // Удаляем из localStorage если не смогли открыть кошелёк
      try {
        const pendingPayments = JSON.parse(localStorage.getItem('pending_payments') || '[]');
        const updated = pendingPayments.filter((pid: string) => pid !== dealId);
        localStorage.setItem('pending_payments', JSON.stringify(updated));
      } catch {}
    }
  };

  const handleViewBlockchain = () => {
    if (!escrowAddress) return;
    window.open(`https://tonviewer.com/${escrowAddress}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Оплата сделки</DialogTitle>
          <DialogDescription>
            Реклама в канале {channelName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Таймер истечения */}
          {expiresAt && (
            <div className="flex items-center justify-center gap-2 text-yellow-500 bg-yellow-500/10 rounded-lg py-2">
              <span className="text-sm">Осталось на оплату:</span>
              <ExpirationTimer 
                expiresAt={expiresAt} 
                showIcon={false}
                onExpire={() => onOpenChange(false)}
              />
            </div>
          )}

          {/* Сумма к оплате */}
          <div className="bg-secondary/50 rounded-xl p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">К оплате</p>
            <div className="flex items-center justify-center gap-2">
              <img src={TonIcon} alt="TON" className="w-6 h-6" />
              <span className="text-2xl font-bold text-foreground">
                {totalPrice} TON
              </span>
            </div>
            {usdEquivalent && (
              <p className="text-sm text-muted-foreground mt-1">
                ≈ ${usdEquivalent.toFixed(2)}
              </p>
            )}
          </div>

          {/* Эскроу адрес */}
          {escrowAddress && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Эскроу-адрес:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-secondary/50 rounded-lg px-3 py-2 text-xs font-mono text-foreground break-all">
                  {escrowAddress}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyAddress}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Кнопки */}
          <div className="flex flex-col gap-2">
            <Button
              onClick={handlePayViaWallet}
              disabled={isPaying || !escrowAddress}
              className="w-full"
            >
              {isPaying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Оплата...
                </>
              ) : (
                <>
                  <Wallet className="w-4 h-4 mr-2" />
                  Оплатить через кошелёк
                </>
              )}
            </Button>

            {escrowAddress && (
              <Button
                variant="outline"
                onClick={handleViewBlockchain}
                className="w-full"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Посмотреть в блокчейне
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            После оплаты средства будут храниться на эскроу до завершения размещения
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
