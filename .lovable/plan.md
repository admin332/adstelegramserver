

## Исправление открытия кошелька при оплате в Telegram Mini App

### Проблема

При подключении кошелька через `TonConnectButton` всё работает правильно — открывается внешнее приложение (MyTonWallet, Tonkeeper). Но при оплате через `sendTransaction` кошелёк не открывается, хотя транзакция вызывается.

### Найденная причина

1. **`TonConnectButton`** — использует встроенную логику SDK с правильным deeplink/universal link для открытия внешнего кошелька

2. **`sendTransaction`** — по умолчанию показывает только modal `['before']`, который отображает QR-код или ссылку для подключения, но может неправильно триггерить открытие внешнего приложения в Telegram WebView

3. **Отсутствуют правильные опции modals/notifications** — нужно явно указать их для корректного поведения

Согласно документации TonConnect:
```typescript
// Default configuration:
const defaultBehaviour = {
  modals: ['before'],
  notifications: ['before', 'success', 'error']
}
```

Но для правильного открытия внешнего кошелька в Telegram Mini App нужно:
- Использовать `modals: ['before', 'success', 'error']` для показа modal с ссылкой
- Убедиться что `skipRedirectToWallet: 'never'` установлен правильно
- Добавить `returnStrategy` в опции sendTransaction

---

### План изменений

#### 1. `src/components/deals/PaymentDialog.tsx`

**Изменение опций sendTransaction:**

```typescript
// Было:
await tonConnectUI.sendTransaction(
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
  }
);

// Станет:
await tonConnectUI.sendTransaction(
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
    modals: ['before', 'success', 'error'],
    notifications: ['before', 'success', 'error'],
    returnStrategy: window.Telegram?.WebApp?.initData ? 'tg://resolve' : 'back',
    twaReturnUrl: 'https://t.me/adsingo_bot/open',
    skipRedirectToWallet: 'never',
  }
);
```

---

#### 2. `src/components/channel/PaymentStep.tsx`

**Аналогичное изменение:**

```typescript
// Было:
await tonConnectUI.sendTransaction(transaction, {
  skipRedirectToWallet: 'never',
});

// Станет:
await tonConnectUI.sendTransaction(transaction, {
  modals: ['before', 'success', 'error'],
  notifications: ['before', 'success', 'error'],
  returnStrategy: window.Telegram?.WebApp?.initData ? 'tg://resolve' : 'back',
  twaReturnUrl: 'https://t.me/adsingo_bot/open',
  skipRedirectToWallet: 'never',
});
```

---

#### 3. `src/main.tsx` — добавить глобальную конфигурацию для всех действий

**Добавить `actionsConfiguration` с полными настройками:**

```typescript
// Станет:
<TonConnectUIProvider 
  manifestUrl={manifestUrl}
  actionsConfiguration={{
    returnStrategy: returnStrategy as 'back' | 'tg://resolve',
    twaReturnUrl: 'https://t.me/adsingo_bot/open',
    modals: ['before', 'success', 'error'],
    notifications: ['before', 'success', 'error'],
    skipRedirectToWallet: 'never',
  }}
>
```

---

### Техническое объяснение

| Параметр | Значение | Что делает |
|----------|----------|------------|
| `modals: ['before', 'success', 'error']` | Показывать модалки до, после и при ошибке | Modal "before" показывает кнопку/ссылку для открытия кошелька |
| `notifications: ['before', 'success', 'error']` | Показывать уведомления | Информирует пользователя о статусе |
| `returnStrategy: 'tg://resolve'` | Telegram protocol для возврата | Позволяет вернуться в Mini App после подписи |
| `twaReturnUrl` | URL для возврата | Ссылка на Mini App |
| `skipRedirectToWallet: 'never'` | Всегда пытаться открыть кошелёк | Принудительный редирект в кошелёк |

---

### Ожидаемый результат

1. При нажатии "Оплатить" появится модальное окно TonConnect
2. В модальном окне будет кнопка для открытия кошелька (MyTonWallet, Tonkeeper)
3. При клике на кнопку откроется внешнее приложение кошелька
4. После подписи транзакции пользователь вернётся в Mini App
5. Поведение будет аналогично подключению кошелька через `TonConnectButton`

---

### Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/main.tsx` | Добавить `modals`, `notifications`, `skipRedirectToWallet` в actionsConfiguration |
| `src/components/deals/PaymentDialog.tsx` | Добавить полные опции в sendTransaction |
| `src/components/channel/PaymentStep.tsx` | Добавить полные опции в sendTransaction |

