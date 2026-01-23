// Telegram WebApp utilities

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    query_id?: string;
    user?: TelegramUser;
    auth_date?: number;
    hash?: string;
  };
  ready: () => void;
  expand: () => void;
  close: () => void;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  isVerticalSwipesEnabled: boolean;
  // Fullscreen API (Bot API 7.0+)
  isFullscreen?: boolean;
  requestFullscreen?: () => void;
  exitFullscreen?: () => void;
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
  };
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
  disableVerticalSwipes: () => void;
  enableVerticalSwipes: () => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window !== "undefined" && window.Telegram?.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
}

export function isTelegramMiniApp(): boolean {
  const webapp = getTelegramWebApp();
  return webapp !== null && webapp.initData !== "";
}

export function getTelegramInitData(): string | null {
  const webapp = getTelegramWebApp();
  if (webapp && webapp.initData) {
    return webapp.initData;
  }
  return null;
}

export function getTelegramUser(): TelegramUser | null {
  const webapp = getTelegramWebApp();
  if (webapp?.initDataUnsafe?.user) {
    return webapp.initDataUnsafe.user;
  }
  return null;
}

export function initTelegramApp(): void {
  const webapp = getTelegramWebApp();
  if (webapp) {
    try {
      // Сообщаем Telegram что приложение готово
      webapp.ready();
      
      // Пробуем запросить настоящий Fullscreen (Bot API 7.0+)
      try {
        if (typeof webapp.requestFullscreen === 'function') {
          webapp.requestFullscreen();
        } else {
          webapp.expand();
        }
      } catch (e) {
        console.log('[Telegram] Fullscreen not supported, using expand');
        webapp.expand();
      }
      
      // Отключаем вертикальные свайпы (защита от случайного закрытия)
      try {
        if (typeof webapp.disableVerticalSwipes === 'function') {
          webapp.disableVerticalSwipes();
        }
      } catch (e) {
        console.log('[Telegram] disableVerticalSwipes not supported');
      }
      
      // Включаем подтверждение закрытия
      try {
        webapp.enableClosingConfirmation();
      } catch (e) {
        console.log('[Telegram] enableClosingConfirmation not supported');
      }
      
      // Устанавливаем цвета
      try {
        webapp.setHeaderColor('#1484fb');
        webapp.setBackgroundColor('#000000');
      } catch (e) {
        console.log('[Telegram] setHeaderColor/setBackgroundColor not supported');
      }
    } catch (e) {
      console.warn('[Telegram] Failed to initialize WebApp:', e);
    }
  }
}
