
## Исправление открытия внешнего кошелька (MyTonWallet) в Telegram Mini App

### Диагноз проблемы

Найдена точная причина: функция `openExternalWalletApp` возвращает `false` потому что:

1. **Неправильный источник данных**: код ищет `universalLink` в `tonConnectUI.wallet`, но там его НЕТ
2. **Правильные источники**:
   - `tonConnectUI.walletInfo` — содержит `universalLink` и `deepLink`
   - Callback `onRequestSent` в `sendTransaction` — официальный способ, даёт готовую функцию `redirectToWallet`

Структура объектов TonConnect:
```text
tonConnectUI.wallet = { account, device, ... } // Нет universalLink!
tonConnectUI.walletInfo = { universalLink, deepLink, appName, ... } // ← Нужные данные тут!
```

### Изменения

#### 1. `src/lib/tonWalletUtils.ts` — исправить получение URL кошелька

Было:
```typescript
const wallet = tonConnectUI.wallet;
const universalLink = wallet.universalLink || wallet.openMethod?.universalLink;
```

Станет:
```typescript
// Используем walletInfo вместо wallet
// @ts-ignore - walletInfo содержит universalLink для remote wallets
const walletInfo = tonConnectUI.walletInfo;
const universalLink = walletInfo?.universalLink;
const deepLink = walletInfo?.deepLink;
```

Добавить логирование структуры для диагностики в будущем.

#### 2. `src/components/channel/PaymentStep.tsx` — использовать официальный callback

TonConnect SDK предоставляет callback `onRequestSent` с готовой функцией `redirectToWallet`. Это официальный и самый надёжный способ:

```typescript
const txPromise = tonConnectUI.sendTransaction(transaction, {
  skipRedirectToWallet: 'never',
  onRequestSent: (redirectToWallet) => {
    // Вызываем редирект после отправки запроса на мост
    redirectToWallet();
    // Показываем подсказку через 2 сек, если не открылось
    setTimeout(() => setShowWalletHint(true), 2000);
  },
});
```

Удалить ручной вызов `openExternalWalletApp` в setTimeout — он больше не нужен, официальный callback надёжнее.

#### 3. `src/components/deals/PaymentDialog.tsx` — аналогичное исправление

Добавить `onRequestSent` callback для автоматического редиректа.

### Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/lib/tonWalletUtils.ts` | Использовать `tonConnectUI.walletInfo` вместо `tonConnectUI.wallet` |
| `src/components/channel/PaymentStep.tsx` | Добавить `onRequestSent` callback с `redirectToWallet()` |
| `src/components/deals/PaymentDialog.tsx` | Добавить `onRequestSent` callback |

### Почему это исправит проблему

1. **`walletInfo`** — содержит реальный `universalLink` (например `https://connect.mytonwallet.org`)
2. **`onRequestSent`** — официальный callback, который TonConnect вызывает когда запрос УЖЕ отправлен на bridge и можно редиректить
3. **`redirectToWallet()`** — внутренняя функция SDK, которая знает все нюансы редиректа для конкретного кошелька

### Ожидаемый результат

1. После нажатия "Оплатить" → MyTonWallet откроется автоматически
2. Если авто-редирект не сработает → кнопка "Открыть MyTonWallet" будет работать корректно
3. Логи покажут реальный URL кошелька для диагностики
