

## Исправление открытия кошелька при оплате — принудительный redirect через universalLink

### Проблема

При подключении кошелька через `TonConnectButton` всё работает — кошелёк открывается. Но при оплате через `sendTransaction` кошелёк не открывается, хотя транзакция уходит в bridge.

**Причина:** При вызове `connect()` SDK автоматически открывает `universalLink` кошелька. Но при `sendTransaction` SDK отправляет запрос через bridge и ждёт ответа, НЕ открывая кошелёк принудительно в TMA-окружении.

### Решение

После вызова `sendTransaction` нужно вручную открыть `universalLink` подключённого кошелька, если:
1. Мы находимся в Telegram Mini App
2. Это внешний кошелёк (не встроенный @wallet)

---

## Изменения

### 1. `src/components/channel/PaymentStep.tsx`

Добавить логику открытия кошелька после sendTransaction:

```typescript
const handlePayViaWallet = async () => {
  if (!escrowAddress) return;
  
  setIsPaying(true);
  
  const amountNano = Math.floor(totalPriceTon * 1_000_000_000).toString();
  
  const transaction = {
    validUntil: Math.floor(Date.now() / 1000) + 600,
    messages: [
      {
        address: escrowAddress,
        amount: amountNano,
      },
    ],
  };
  
  // Получаем информацию о подключённом кошельке ДО отправки
  const currentWallet = tonConnectUI.wallet;
  const walletInfo = tonConnectUI.walletInfo;
  
  try {
    // Отправляем транзакцию
    const sendPromise = tonConnectUI.sendTransaction(transaction, {
      modals: ['before', 'success', 'error'],
      notifications: ['before', 'success', 'error'],
      returnStrategy: window.Telegram?.WebApp?.initData ? 'tg://resolve' : 'back',
      twaReturnUrl: 'https://t.me/adsingo_bot/open',
      skipRedirectToWallet: 'never',
    });
    
    // Если это TMA и внешний кошелёк — принудительно открываем его
    const isTMA = Boolean(window.Telegram?.WebApp?.initData);
    const isExternalWallet = walletInfo && 
      'universalLink' in walletInfo && 
      walletInfo.universalLink;
    
    if (isTMA && isExternalWallet) {
      // Небольшая задержка, чтобы запрос ушёл в bridge
      setTimeout(() => {
        window.location.href = walletInfo.universalLink!;
      }, 100);
    }
    
    await sendPromise;
    toast.success('Транзакция отправлена!');
    onPaymentComplete();
  } catch (error: any) {
    // ... обработка ошибок
  } finally {
    setIsPaying(false);
  }
};
```

---

### 2. `src/components/deals/PaymentDialog.tsx`

Аналогичная логика:

```typescript
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
  
  // Получаем информацию о подключённом кошельке ДО отправки
  const walletInfo = tonConnectUI.walletInfo;
  
  try {
    const amountNano = Math.floor(totalPrice * 1_000_000_000).toString();
    
    const sendPromise = tonConnectUI.sendTransaction(
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
    
    // Если это TMA и внешний кошелёк — принудительно открываем его
    const isTMA = Boolean(window.Telegram?.WebApp?.initData);
    const isExternalWallet = walletInfo && 
      'universalLink' in walletInfo && 
      walletInfo.universalLink;
    
    if (isTMA && isExternalWallet) {
      setTimeout(() => {
        window.location.href = walletInfo.universalLink!;
      }, 100);
    }
    
    await sendPromise;
    toast.success("Транзакция отправлена!");
    onPaymentSuccess?.();
    onOpenChange(false);
  } catch (error: any) {
    // ... обработка ошибок
  } finally {
    setIsPaying(false);
  }
};
```

---

## Техническое объяснение

| Шаг | Что происходит |
|-----|----------------|
| 1 | Получаем `walletInfo` с `universalLink` подключённого кошелька |
| 2 | Вызываем `sendTransaction()` — запрос уходит через bridge |
| 3 | Через 100мс открываем `window.location.href = universalLink` |
| 4 | Кошелёк получает запрос из bridge и показывает подтверждение |
| 5 | После подписи пользователь возвращается в TMA через `twaReturnUrl` |

---

## Почему это работает

- При `connect()` SDK сам открывает universalLink кошелька
- При `sendTransaction()` SDK только отправляет запрос в bridge, но НЕ открывает кошелёк автоматически в TMA
- iOS/Android в TMA блокируют автоматические редиректы, но разрешают их в контексте пользовательского клика
- Мы вызываем `window.location.href` синхронно в обработчике клика, поэтому редирект сработает

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/components/channel/PaymentStep.tsx` | Добавить принудительное открытие universalLink после sendTransaction |
| `src/components/deals/PaymentDialog.tsx` | Аналогичное изменение |

---

## Ожидаемый результат

1. Пользователь нажимает "Оплатить"
2. Запрос отправляется в bridge
3. Автоматически открывается внешний кошелёк (MyTonWallet, Tonkeeper)
4. Пользователь видит запрос на подтверждение транзакции
5. После подтверждения возвращается в Mini App
6. Поведение идентично подключению кошелька

