

## План: Редирект на /deals после оплаты + статус "Проверка оплаты"

### Текущее поведение

1. Пользователь открывает `PaymentDialog` и нажимает "Оплатить"
2. Транзакция отправляется в кошелёк
3. Пользователь остаётся в диалоге — ничего не меняется
4. Статус "Ожидает оплаты" сохраняется, пока бэкенд не подтвердит оплату

### Желаемое поведение

1. После отправки транзакции → закрыть диалог и перенаправить на `/deals`
2. Отображать "Проверка оплаты" вместо "Ожидает оплаты" для этой сделки
3. Кнопка "Оплатить" остаётся доступной (на случай повторной попытки)

```text
┌──────────────────────────────────────────────────────────────┐
│                     ТЕКУЩИЙ ФЛОУ                             │
├──────────────────────────────────────────────────────────────┤
│  [PaymentDialog] ──> sendTransaction ──> остаёмся в диалоге  │
│                                                              │
│  Статус: "Ожидает оплаты" ──────────────────────────────────►│
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                     НОВЫЙ ФЛОУ                               │
├──────────────────────────────────────────────────────────────┤
│  [PaymentDialog] ──> sendTransaction ──> закрыть диалог      │
│                          │                                   │
│                          ▼                                   │
│               localStorage.set("pending_payment", dealId)    │
│                          │                                   │
│                          ▼                                   │
│               navigate("/deals")                             │
│                          │                                   │
│                          ▼                                   │
│  [DealCard] ──> check localStorage ──> "Проверка оплаты"     │
│             + кнопка "Оплатить" доступна                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Техническая реализация

### 1. Файл: `src/components/deals/PaymentDialog.tsx`

**Изменения:**

- Добавить `useNavigate` из `react-router-dom`
- После успешной отправки транзакции (`.then()`):
  - Сохранить dealId в localStorage как "проверяемый"
  - Закрыть диалог
  - Перенаправить на `/deals`
  - Вызвать `onPaymentSuccess` для обновления данных

```tsx
import { useNavigate } from "react-router-dom";

// В компоненте:
const navigate = useNavigate();

// В handlePayViaWallet, после sendTransaction:
tonConnectUI.sendTransaction(transaction, options)
  .then(() => {
    // Сохраняем ID сделки как "проверяющую оплату"
    const pendingPayments = JSON.parse(localStorage.getItem('pending_payments') || '[]');
    if (!pendingPayments.includes(dealId)) {
      pendingPayments.push(dealId);
      localStorage.setItem('pending_payments', JSON.stringify(pendingPayments));
    }
    
    // Закрываем диалог
    onOpenChange(false);
    
    // Вызываем callback и перенаправляем
    onPaymentSuccess?.();
    navigate('/deals');
    
    toast.success("Транзакция отправлена! Проверяем оплату...");
  })
  .catch(...)
```

---

### 2. Файл: `src/components/DealCard.tsx`

**Изменения:**

- Проверять localStorage на наличие `dealId` в списке "pending_payments"
- Если сделка в списке и статус `pending` → показывать "Проверка оплаты"
- Если статус изменился на `escrow` → удалить из localStorage
- Кнопка "Оплатить" остаётся доступной

```tsx
// Добавить в начало компонента:
const isPendingPayment = (() => {
  if (status !== 'pending') return false;
  try {
    const pendingPayments = JSON.parse(localStorage.getItem('pending_payments') || '[]');
    return pendingPayments.includes(id);
  } catch {
    return false;
  }
})();

// Очистка localStorage при смене статуса
useEffect(() => {
  if (status === 'escrow') {
    try {
      const pendingPayments = JSON.parse(localStorage.getItem('pending_payments') || '[]');
      const updated = pendingPayments.filter((pid: string) => pid !== id);
      localStorage.setItem('pending_payments', JSON.stringify(updated));
    } catch {}
  }
}, [status, id]);

// Изменить dynamicStatusLabel для pending:
if (status === "pending" && isPendingPayment) {
  dynamicStatusLabel = "Проверка оплаты";
}
```

---

### 3. Файл: `src/pages/Deals.tsx`

**Изменения:**

- Добавить автоматическое обновление данных каждые 5-10 секунд, пока есть сделки в состоянии "проверка оплаты"
- Это позволит быстро отобразить изменение статуса после подтверждения бэкендом

```tsx
// Добавить в useUserDeals:
const { refetch } = useUserDeals();

// Автообновление при наличии pending_payments
useEffect(() => {
  const pendingPayments = JSON.parse(localStorage.getItem('pending_payments') || '[]');
  if (pendingPayments.length === 0) return;
  
  const interval = setInterval(() => {
    refetch();
  }, 5000);
  
  return () => clearInterval(interval);
}, [refetch]);
```

---

## Дополнительная конфигурация статуса

### Обновить `statusConfig` в `DealCard.tsx`:

Не требуется добавлять новый статус в базу данных — мы используем тот же `pending`, но с другим отображением.

| Состояние | Реальный статус | Отображение | Кнопка "Оплатить" |
|-----------|-----------------|-------------|-------------------|
| До оплаты | `pending` | "Ожидает оплаты" | Доступна |
| После отправки транзакции | `pending` + localStorage | "Проверка оплаты" | Доступна |
| Оплата подтверждена | `escrow` | "Оплачено" | Скрыта |

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/components/deals/PaymentDialog.tsx` | Добавить редирект на /deals после отправки транзакции |
| `src/components/DealCard.tsx` | Показывать "Проверка оплаты" для pending + localStorage |
| `src/pages/Deals.tsx` | Добавить автообновление пока есть pending_payments |

