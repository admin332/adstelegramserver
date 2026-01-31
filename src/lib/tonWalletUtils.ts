// Утилиты для работы с внешними TON кошельками в Telegram Mini App
import { TonConnectUI } from '@tonconnect/ui-react';

/**
 * Открывает внешнее приложение кошелька через Telegram WebApp API
 * Это нужно для обхода ограничений WebView на iOS/Android,
 * когда TonConnect SDK не может автоматически открыть кошелёк
 */
export function openExternalWalletApp(tonConnectUI: TonConnectUI): boolean {
  try {
    // ВАЖНО: universalLink и deepLink находятся в walletInfo, а НЕ в wallet!
    // wallet содержит только account и device
    // walletInfo содержит информацию о приложении кошелька включая ссылки
    // @ts-ignore - walletInfo существует но не типизирован
    const walletInfo = tonConnectUI.walletInfo;
    const wallet = tonConnectUI.wallet;
    
    console.log('[TonWallet] wallet:', JSON.stringify(wallet, null, 2));
    console.log('[TonWallet] walletInfo:', JSON.stringify(walletInfo, null, 2));
    
    if (!wallet) {
      console.log('[TonWallet] No wallet connected');
      return false;
    }

    // Получаем ссылку из walletInfo (правильный источник)
    const universalLink = walletInfo?.universalLink;
    const deepLink = walletInfo?.deepLink;
    
    const walletUrl = deepLink || universalLink;
    
    if (!walletUrl) {
      console.log('[TonWallet] No wallet URL found in walletInfo');
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
  // @ts-ignore - walletInfo содержит name/appName
  const walletInfo = tonConnectUI.walletInfo;
  const wallet = tonConnectUI.wallet;
  
  if (!wallet && !walletInfo) return 'кошелёк';
  
  // Приоритет: walletInfo.name > wallet.device.appName
  const name = walletInfo?.name || wallet?.device?.appName || 'кошелёк';
  return name;
}

/**
 * Проверяет, является ли кошелёк внешним (не встроенным Telegram Wallet)
 */
export function isExternalWallet(tonConnectUI: TonConnectUI): boolean {
  // @ts-ignore
  const walletInfo = tonConnectUI.walletInfo;
  const wallet = tonConnectUI.wallet;
  
  if (!wallet) return false;
  
  // Приоритет: walletInfo.name > wallet.device.appName
  const appName = (walletInfo?.name || wallet?.device?.appName || '').toLowerCase();
  
  // Встроенный Telegram Wallet работает через JS-bridge, ему не нужен внешний открыватель
  return !appName.includes('telegram') && appName !== 'wallet';
}
