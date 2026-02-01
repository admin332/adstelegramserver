

## План: Использование `onRequestSent` для редиректа после оплаты

### Проблема

1. Вы оплачиваете через **мастер создания заказа** (`PaymentStep.tsx`)
2. Используете **Telegram Wallet (встроенный)**
3. После подтверждения оплаты — **остаётесь в модалке оплаты**, хотя транзакция отправлена

### Причина

В `PaymentStep.tsx` нет:
- Сохранения в localStorage для отслеживания "проверяющихся" платежей
- Callback `onRequestSent` — специальная функция SDK, которая вызывается **сразу после отправки транзакции в кошелёк**
- Перенаправления на страницу сделок

### Решение

TonConnect SDK поддерживает callback **`onRequestSent`**, который вызывается когда транзакция успешно отправлена в кошелёк (до получения ответа). Это идеальный момент для:
1. Сохранения dealId в localStorage
2. Закрытия модалки/мастера
3. Перенаправления на `/deals`

```text
┌─────────────────────────────────────────────────────────────────┐
│                      ТЕКУЩИЙ ФЛОУ                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [PaymentStep] ──> sendTransaction() ──> [Telegram Wallet]      │
│       │                                        │                │
│       │                                        ├── Confirm      │
│       │                                        │                │
│       │  (Promise pending forever in TMA)      │                │
│       ▼                                        ▼                │
│  UI застряла                            "Transaction sent"      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      НОВЫЙ ФЛОУ с onRequestSent                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [PaymentStep] ──> sendTransaction({                            │
│                      onRequestSent: () => {                     │
│                        localStorage.set(dealId)                 │
│                        navigate('/deals')                       │
│                      }                                          │
│                    })                                           │
│       │                                                         │
│       │  ← onRequestSent вызывается СРАЗУ после отправки        │
│       ▼                                                         │
│  Редирект на /deals + статус "Проверка оплаты"                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Техническая реализация

### 1. Файл: `src/components/channel/PaymentStep.tsx`

Добавить:
- Пропс `dealId` для отслеживания транзакции
- `useNavigate` для перенаправления
- Callback `onRequestSent` в опциях `sendTransaction`

```tsx
interface PaymentStepProps {
  dealId?: string;  // НОВЫЙ пропс
  totalPriceTon: number;
  escrowAddress: string | null;
  isCreatingDeal: boolean;
  onPaymentComplete: () => void;
}

// В функции handlePayViaWallet:
tonConnectUI.sendTransaction(transaction, {
  modals: ['success', 'error'],
  notifications: ['before', 'success', 'error'],
  returnStrategy: 'tg://resolve',
  twaReturnUrl: 'https://t.me/adsingo_bot/open',
  
  // НОВОЕ: Callback вызывается сразу после отправки транзакции в кошелёк
  onRequestSent: () => {
    console.log('[TonConnect] onRequestSent triggered');
    
    // Сохраняем в localStorage
    if (dealId) {
      try {
        const pendingPayments = JSON.parse(localStorage.getItem('pending_payments') || '[]');
        if (!pendingPayments.includes(dealId)) {
          pendingPayments.push(dealId);
          localStorage.setItem('pending_payments', JSON.stringify(pendingPayments));
        }
      } catch {}
    }
    
    // Перенаправляем на /deals
    navigate('/deals');
    toast.success("Транзакция отправлена! Проверяем оплату...");
  }
}).then(...)
```

---

### 2. Файл: `src/components/deals/PaymentDialog.tsx`

Применить тот же подход с `onRequestSent`:

```tsx
tonConnectUI.sendTransaction(transaction, {
  modals: ['success', 'error'],
  notifications: ['before', 'success', 'error'],
  returnStrategy: 'tg://resolve',
  twaReturnUrl: 'https://t.me/adsingo_bot/open',
  
  // НОВОЕ: Callback вызывается сразу после отправки транзакции в кошелёк
  onRequestSent: () => {
    console.log('[TonConnect] onRequestSent triggered');
    
    // dealId уже сохранён в localStorage выше
    // Закрываем диалог и перенаправляем
    onOpenChange(false);
    onPaymentSuccess?.();
    navigate('/deals');
    toast.success("Транзакция отправлена! Проверяем оплату...");
  }
}).then(...)
```

---

### 3. Передать `dealId` в `PaymentStep`

Нужно проверить компонент, который использует `PaymentStep`, и убедиться, что `dealId` передаётся после создания сделки.

---

## Что делает `onRequestSent`?

| Момент | Что происходит |
|--------|----------------|
| Пользователь нажимает "Оплатить" | `sendTransaction()` вызывается |
| SDK отправляет запрос в кошелёк | **`onRequestSent()` срабатывает** |
| Пользователь подтверждает в кошельке | Кошелёк отправляет транзакцию в блокчейн |
| Promise resolve'ится | `.then()` выполняется (может не сработать в TMA) |

**Ключевое преимущество**: `onRequestSent` вызывается **синхронно** в том же контексте, поэтому редирект сработает даже в TMA!

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/components/channel/PaymentStep.tsx` | Добавить `dealId` пропс, `useNavigate`, `onRequestSent` callback |
| `src/components/deals/PaymentDialog.tsx` | Добавить `onRequestSent` callback |
| Родительский компонент `PaymentStep` | Передать `dealId` после создания сделки |

