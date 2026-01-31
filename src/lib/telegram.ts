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
  platform: string; // 'android', 'ios', 'tdesktop', 'web', 'macos', 'weba'
  ready: () => void;
  expand: () => void;
  close: () => void;
  openTelegramLink: (url: string) => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
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
  // BackButton API
  BackButton: {
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
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

export function isMobilePlatform(): boolean {
  const webapp = getTelegramWebApp();
  if (!webapp) return false;
  
  const platform = webapp.platform?.toLowerCase() || '';
  return platform === 'android' || platform === 'ios';
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
    // Сообщаем Telegram что приложение готово
    webapp.ready();
    
    // Fullscreen только для мобильных устройств
    const isMobile = isMobilePlatform();
    
    if (isMobile) {
      // На мобильных — пробуем полноэкранный режим
      try {
        if (typeof webapp.requestFullscreen === 'function') {
          webapp.requestFullscreen();
        } else {
          webapp.expand();
        }
      } catch (e) {
        console.log('Fullscreen not supported, using expand');
        webapp.expand();
      }
      
      // Отключаем вертикальные свайпы только на мобильных
      if (typeof webapp.disableVerticalSwipes === 'function') {
        webapp.disableVerticalSwipes();
      }
    } else {
      // На десктопе — просто expand без fullscreen
      webapp.expand();
    }
    
    // Включаем подтверждение закрытия
    webapp.enableClosingConfirmation();
    
    // Устанавливаем синий цвет заголовка
    webapp.setHeaderColor('#1484fb');
    webapp.setBackgroundColor('#000000');
  }
}
