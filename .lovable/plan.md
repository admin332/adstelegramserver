

## Отключение полноэкранного режима для компьютеров в Telegram

Добавим проверку платформы, чтобы fullscreen режим активировался только на мобильных устройствах.

---

## Как это работает

Telegram WebApp API предоставляет свойство `platform`:
- `"android"` — Android устройства
- `"ios"` — iPhone/iPad
- `"tdesktop"` — Telegram Desktop (Windows/Mac/Linux)
- `"web"` — Web версия Telegram
- `"macos"` — Telegram для macOS
- `"weba"` — Telegram Web App A

---

## Что изменится

| Платформа | Сейчас | После |
|-----------|--------|-------|
| Android / iOS | Fullscreen | Fullscreen |
| Desktop (tdesktop, macos) | Fullscreen | Только expand |
| Web (web, weba) | Fullscreen | Только expand |

---

## Изменяемый файл

**src/lib/telegram.ts**

### 1. Добавить `platform` в интерфейс TelegramWebApp

```typescript
export interface TelegramWebApp {
  // ... existing fields
  platform: string; // 'android', 'ios', 'tdesktop', 'web', 'macos', 'weba'
  // ...
}
```

### 2. Создать функцию проверки мобильной платформы

```typescript
export function isMobilePlatform(): boolean {
  const webapp = getTelegramWebApp();
  if (!webapp) return false;
  
  const platform = (webapp as any).platform?.toLowerCase() || '';
  return platform === 'android' || platform === 'ios';
}
```

### 3. Обновить функцию `initTelegramApp`

```typescript
export function initTelegramApp(): void {
  const webapp = getTelegramWebApp();
  if (webapp) {
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
    
    webapp.enableClosingConfirmation();
    webapp.setHeaderColor('#1484fb');
    webapp.setBackgroundColor('#000000');
  }
}
```

---

## Результат

| Устройство | Поведение |
|------------|-----------|
| **Телефон (iOS/Android)** | Полноэкранный режим, свайпы отключены |
| **Компьютер (Desktop/Web)** | Обычное окно с expand, свайпы включены |

