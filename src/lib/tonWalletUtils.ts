// Утилиты для работы с внешними TON кошельками в Telegram Mini App
import { TonConnectUI } from '@tonconnect/ui-react';

/**
 * Открывает внешнее приложение кошелька через Telegram WebApp API
 * Это нужно для обхода ограничений WebView на iOS/Android,
 * когда TonConnect SDK не может автоматически открыть кошелёк
 */
export function openExternalWalletApp(tonConnectUI: TonConnectUI): boolean {
  try {
    const wallet = tonConnectUI.wallet;
    
    if (!wallet) {
      console.log('[TonWallet] No wallet connected');
      return false;
    }

    // Получаем ссылку на кошелёк (универсальная или deep link)
    // @ts-ignore - wallet может иметь разные структуры в зависимости от типа
    const universalLink = wallet.universalLink || wallet.openMethod?.universalLink;
    // @ts-ignore
    const deepLink = wallet.deepLink || wallet.openMethod?.deepLink;
    
    const walletUrl = deepLink || universalLink;
    
    if (!walletUrl) {
      console.log('[TonWallet] No wallet URL found, wallet object:', JSON.stringify(wallet, null, 2));
      return false;
    }

    console.log('[TonWallet] Opening wallet URL:', walletUrl);
    
    // Проверяем, находимся ли мы в Telegram Mini App
    const tgWebApp = window.Telegram?.WebApp;
    
    if (tgWebApp && typeof tgWebApp.openLink === 'function') {
      // Используем Telegram WebApp API для корректного открытия внешнего приложения
      // Это самый надёжный способ в Telegram WebView
      console.log('[TonWallet] Using Telegram.WebApp.openLink');
      tgWebApp.openLink(walletUrl);
      return true;
    }
    
    // Fallback: обычное открытие ссылки
    console.log('[TonWallet] Fallback: using window.open');
    window.open(walletUrl, '_blank');
    return true;
    
  } catch (error) {
    console.error('[TonWallet] Error opening wallet:', error);
    return false;
  }
}

/**
 * Получает название подключённого кошелька для отображения в UI
 */
export function getWalletName(tonConnectUI: TonConnectUI): string {
  const wallet = tonConnectUI.wallet;
  if (!wallet) return 'кошелёк';
  
  // @ts-ignore
  const name = wallet.device?.appName || wallet.name || 'кошелёк';
  return name;
}

/**
 * Проверяет, является ли кошелёк внешним (не встроенным Telegram Wallet)
 */
export function isExternalWallet(tonConnectUI: TonConnectUI): boolean {
  const wallet = tonConnectUI.wallet;
  if (!wallet) return false;
  
  // @ts-ignore
  const appName = (wallet.device?.appName || wallet.name || '').toLowerCase();
  
  // Встроенный Telegram Wallet работает через JS-bridge, ему не нужен внешний открыватель
  return !appName.includes('telegram') && appName !== 'wallet';
}
