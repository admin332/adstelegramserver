

## Виправлення оплати в Telegram Mini App — "План Б"

### Проблема

При натисканні "Оплатити" SDK показує модальне вікно з кнопкою "Open Wallet", яка ламається в TMA через:
1. `window.open()` блокується Telegram
2. Зв'язок з bridge втрачається
3. Виникає помилка `TON_CONNECT_SDK_ERROR`

### Рішення

1. **Прибрати модалку `before`** — вона малює те проблемне вікно з кнопкою
2. **Використати `openTelegramLink`** — це нативний метод Telegram WebApp SDK, який працює стабільніше

---

## Зміни

### 1. `src/components/channel/PaymentStep.tsx`

**Строки 70-96 — замінити логіку оплати:**

```typescript
try {
  // Отримуємо посилання на гаманець ЗАЗДАЛЕГІДЬ
  const walletsList = await tonConnectUI.getWallets();
  const connectedWallet = walletsList.find(
    w => w.appName === wallet?.device.appName
  );
  
  // Відправляємо транзакцію (йде в фон через bridge)
  // ВИМИКАЄМО модалку 'before' — вона ламається в TMA
  tonConnectUI.sendTransaction(transaction, {
    modals: ['success', 'error'],  // БЕЗ 'before'!
    notifications: ['before', 'success', 'error'],
    returnStrategy: 'tg://resolve',
    twaReturnUrl: 'https://t.me/adsingo_bot/open',
  });
  
  // МИТТЄВО перекидаємо користувача в гаманець
  const isTMA = Boolean(window.Telegram?.WebApp?.initData);
  
  if (isTMA && connectedWallet && 'universalLink' in connectedWallet && connectedWallet.universalLink) {
    const link = connectedWallet.universalLink as string;
    
    // Найнадійніший спосіб для TMA — нативний метод Telegram
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(link);
    } else {
      window.location.href = link;
    }
  } else if (!isTMA && connectedWallet && 'universalLink' in connectedWallet && connectedWallet.universalLink) {
    // Для звичайного браузера
    window.location.href = connectedWallet.universalLink as string;
  }
  
  // Не чекаємо sendPromise — користувач вже в гаманці
  toast.success('Перенаправляємо в гаманець...');
  // onPaymentComplete() викличеться після повернення через webhook або polling
  
} catch (error: any) {
  // ... обробка помилок
}
```

---

### 2. `src/components/deals/PaymentDialog.tsx`

**Строки 74-118 — аналогічна заміна:**

```typescript
try {
  const amountNano = Math.floor(totalPrice * 1_000_000_000).toString();
  
  // Отримуємо посилання на гаманець ЗАЗДАЛЕГІДЬ
  const walletsList = await tonConnectUI.getWallets();
  const connectedWallet = walletsList.find(
    w => w.appName === wallet?.device.appName
  );
  
  // Відправляємо транзакцію БЕЗ модалки 'before'
  tonConnectUI.sendTransaction(
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
      modals: ['success', 'error'],  // БЕЗ 'before'!
      notifications: ['before', 'success', 'error'],
      returnStrategy: 'tg://resolve',
      twaReturnUrl: 'https://t.me/adsingo_bot/open',
    }
  );
  
  // МИТТЄВО перекидаємо користувача в гаманець
  const isTMA = Boolean(window.Telegram?.WebApp?.initData);
  
  if (isTMA && connectedWallet && 'universalLink' in connectedWallet && connectedWallet.universalLink) {
    const link = connectedWallet.universalLink as string;
    
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(link);
    } else {
      window.location.href = link;
    }
  } else if (!isTMA && connectedWallet && 'universalLink' in connectedWallet && connectedWallet.universalLink) {
    window.location.href = connectedWallet.universalLink as string;
  }
  
  toast.success('Перенаправляємо в гаманець...');
  
} catch (error: any) {
  // ... обробка помилок
}
```

---

### 3. Додати типи для Telegram WebApp (якщо ще немає)

**Перевірити `src/lib/telegram.ts` або додати глобальні типи:**

```typescript
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        openTelegramLink?: (url: string) => void;
        // ... інші методи
      };
    };
  }
}
```

---

## Що зміниться для користувача

| Було | Стане |
|------|-------|
| Натискає "Оплатити" | Натискає "Оплатити" |
| Бачить модалку SDK з кнопкою | — |
| Натискає "Open Wallet" | — |
| Помилка або нічого | Одразу відкривається гаманець |

---

## Технічне пояснення

| Метод | Чому працює |
|-------|-------------|
| `modals: ['success', 'error']` | Прибираємо `before` — не малюється проблемне вікно |
| `openTelegramLink()` | Нативний метод Telegram SDK, не блокується |
| Виклик редиректу одразу | Синхронно в контексті кліку — дозволено iOS/Android |

---

## Файли для зміни

| Файл | Зміна |
|------|-------|
| `src/components/channel/PaymentStep.tsx` | Прибрати `'before'` з modals, додати `openTelegramLink` |
| `src/components/deals/PaymentDialog.tsx` | Те саме |
| `src/lib/telegram.ts` | Перевірити/додати тип `openTelegramLink` |

---

## Очікуваний результат

1. Користувач натискає "Оплатити"
2. **Без жодних модалок** — одразу відкривається MyTonWallet/Tonkeeper
3. Користувач бачить запит на підтвердження транзакції
4. Після підтвердження повертається в Mini App

