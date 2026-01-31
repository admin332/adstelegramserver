

## Исправление открытия MyTonWallet на iOS в Telegram Mini App

### Диагностика проблемы

1. **Где реальные данные кошелька**: `tonConnectUI.walletInfo` содержит `universalLink` и `deepLink` — исправлено в прошлом коммите
2. **iOS блокирует `openLink()`**: На iOS `Telegram.WebApp.openLink(url)` открывает **Safari**, а НЕ приложение кошелька. Это известный баг Telegram iOS (#1670)
3. **Решение для iOS**: Использовать **custom URL scheme** (`mytonwallet-tc://`) через `window.location.href` вместо `openLink()`

### Структура данных MyTonWallet из wallets-v2.json

```json
{
  "app_name": "mytonwallet",
  "universal_url": "https://connect.mytonwallet.org",
  "deepLink": "mytonwallet-tc://"
}
```

### Изменения

#### 1. `src/lib/tonWalletUtils.ts` — специальная логика для iOS

**Проблема**: `Telegram.WebApp.openLink(universalLink)` на iOS открывает браузер, а не приложение

**Решение**: На iOS использовать `deepLink` (custom scheme) через `window.location.href`:

```typescript
export function openExternalWalletApp(tonConnectUI: TonConnectUI): boolean {
  const walletInfo = tonConnectUI.walletInfo;
  const wallet = tonConnectUI.wallet;
  
  if (!wallet) return false;

  const universalLink = walletInfo?.universalLink;
  const deepLink = walletInfo?.deepLink;
  
  const tgWebApp = window.Telegram?.WebApp;
  const platform = tgWebApp?.platform?.toLowerCase() || '';
  const isIOS = platform === 'ios';
  
  // На iOS используем deepLink (custom scheme) — он обходит ограничения WebView
  // На Android openLink работает нормально
  if (isIOS && deepLink) {
    // Custom scheme открывается через window.location.href
    window.location.href = deepLink;
    return true;
  }
  
  // Fallback: universalLink через openLink (работает на Android)
  const walletUrl = universalLink || deepLink;
  if (!walletUrl) return false;
  
  if (tgWebApp && typeof tgWebApp.openLink === 'function') {
    tgWebApp.openLink(walletUrl);
    return true;
  }
  
  window.open(walletUrl, '_blank');
  return true;
}
```

#### 2. `src/lib/tonWalletUtils.ts` — проверка isExternalWallet

Оставить как есть — уже использует `walletInfo`.

#### 3. PaymentStep.tsx / PaymentDialog.tsx — без изменений

Код уже использует `onRequestSent` callback. Но если `redirectToWallet()` не работает на iOS, кнопка "Открыть кошелёк" (которая вызывает исправленную `openExternalWalletApp`) будет fallback.

### Технические детали

**Почему `window.location.href = deepLink` работает на iOS:**
- Custom URL schemes (`mytonwallet-tc://`, `tonkeeper-tc://`) обрабатываются iOS напрямую
- Telegram WebView не блокирует их, потому что это не HTTP-ссылка
- iOS показывает диалог "Открыть в MyTonWallet?" и переключает на приложение

**Почему `openLink(universalLink)` НЕ работает:**
- Universal Links (`https://connect.mytonwallet.org`) на iOS требуют особой обработки
- `Telegram.WebApp.openLink()` всегда открывает внешний браузер (Safari)
- Safari может (но не обязан) сделать app-switch — это ненадёжно

### Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/lib/tonWalletUtils.ts` | Добавить iOS-специфичную логику с `deepLink` через `window.location.href` |

### Ожидаемый результат

1. **iOS + MyTonWallet**: Нажатие "Открыть кошелёк" → iOS покажет "Открыть в MyTonWallet?" → приложение откроется
2. **Android + любой кошелёк**: `openLink()` работает как раньше
3. **Автоматический редирект**: `redirectToWallet()` от SDK должен сработать (если нет — кнопка fallback)

### Альтернативный подход (если не сработает)

Если `window.location.href = deepLink` не открывает приложение, можно попробовать:

1. **Скрытый iframe** для активации deep link:
```typescript
const iframe = document.createElement('iframe');
iframe.style.display = 'none';
iframe.src = deepLink;
document.body.appendChild(iframe);
setTimeout(() => iframe.remove(), 100);
```

2. **Прямой transfer link** (обходит TonConnect полностью):
```typescript
// Формируем прямую ссылку на оплату
const transferUrl = `https://connect.mytonwallet.org/transfer/${escrowAddress}?amount=${amountNano}`;
```

Но сначала попробуем основной подход с `window.location.href = deepLink`.

