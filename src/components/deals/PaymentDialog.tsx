import { useState } from "react";
import { useTonConnectUI } from "@tonconnect/ui-react";
import { ExternalLink, Copy, Check, Wallet, Loader2, ArrowUpRight } from "lucide-react";
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
import { openExternalWalletApp, getWalletName, isExternalWallet } from "@/lib/tonWalletUtils";

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
  const [tonConnectUI] = useTonConnectUI();
  const [copied, setCopied] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [showWalletHint, setShowWalletHint] = useState(false);
  const { convertToUsd } = useTonPrice();

  const usdEquivalent = convertToUsd(totalPrice);
  const walletName = getWalletName(tonConnectUI);
  const isExternal = isExternalWallet(tonConnectUI);

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

  const handleOpenWallet = () => {
    const opened = openExternalWalletApp(tonConnectUI);
    if (!opened) {
      toast.error('Не удалось открыть кошелёк');
    }
  };

  const handlePayViaWallet = async () => {
    if (!escrowAddress) {
      toast.error("Адрес эскроу не найден");
      return;
    }

    if (!tonConnectUI.connected) {
      toast.error("Сначала подключите кошелёк в профиле");
      return;
    }

    setIsPaying(true);
    setShowWalletHint(false);
    
    try {
      const amountNano = Math.floor(totalPrice * 1_000_000_000).toString();
      
      // Используем официальный callback onRequestSent для редиректа
      const txPromise = tonConnectUI.sendTransaction(
        {
          validUntil: Math.floor(Date.now() / 1000) + 600,
          messages: [
            {
              address: escrowAddress,
              amount: amountNano,
            },
          ],
        },
        {
          skipRedirectToWallet: 'never',
          onRequestSent: (redirectToWallet: () => void) => {
            console.log('[PaymentDialog] Transaction request sent to bridge, redirecting...');
            // Вызываем официальную функцию редиректа от SDK
            redirectToWallet();
            // Показываем подсказку через 2 секунды
            setTimeout(() => {
              setShowWalletHint(true);
            }, 2000);
          },
        }
      );
      
      // Ждём результат транзакции
      await txPromise;
      
      toast.success("Транзакция отправлена!");
      setShowWalletHint(false);
      onPaymentSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      // Расширенное логирование для диагностики
      console.error('[TonConnect] sendTransaction error:', error);
      console.error('[TonConnect] error details:', JSON.stringify(error, null, 2));
      
      // Определяем тип ошибки и показываем понятное сообщение
      const errorMessage = error?.message || '';
      const errorCode = error?.code || '';
      
      if (errorMessage.includes('Interrupted') || errorMessage.includes('cancelled')) {
        toast.error("Оплата отменена");
      } else if (errorMessage.includes('timeout') || errorMessage.includes('bridge')) {
        toast.error("Кошелёк не отвечает. Попробуйте ещё раз.");
      } else if (errorMessage) {
        toast.error(`Ошибка: ${errorMessage}`);
      } else if (errorCode) {
        toast.error(`Ошибка кошелька (${errorCode})`);
      } else {
        toast.error("Не удалось выполнить оплату. Попробуйте ещё раз.");
      }
    } finally {
      setIsPaying(false);
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

            {/* Подсказка: открыть кошелёк вручную */}
            {(showWalletHint || isPaying) && isExternal && (
              <Button 
                variant="outline" 
                onClick={handleOpenWallet}
                className="w-full border-yellow-500/30 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10"
              >
                <ArrowUpRight className="w-4 h-4 mr-2" />
                Открыть {walletName}
              </Button>
            )}

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
