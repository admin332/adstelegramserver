

## План: Исправление редиректа после оплаты в TMA

### Проблема

При оплате через TonConnect в Telegram Mini App:
1. Пользователь нажимает "Оплатить"
2. Открывается кошелёк (Telegram Wallet или внешний)
3. Пользователь подтверждает транзакцию
4. Кошелёк показывает "Transaction sent" (это модалка TonConnect)
5. Пользователь возвращается в приложение через `twaReturnUrl`
6. **НО**: Это новый контекст — старый Promise от `sendTransaction` никогда не resolve'ится
7. Наш `.then()` не выполняется → нет редиректа и записи в localStorage

```text
┌─────────────────────────────────────────────────────────────────┐
│                    ТЕКУЩИЙ ПРОБЛЕМНЫЙ ФЛОУ                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [App Context 1]                  [Wallet App]                  │
│       │                                │                        │
│       ├── sendTransaction() ─────────► │                        │
│       │   (Promise pending)            │                        │
│       │                                ├── User confirms        │
│       │                                │                        │
│       │   ◄────── twaReturnUrl ────────┤                        │
│       │                                                         │
│  [App Context 2 - NEW!]                                         │
│       │                                                         │
│       │   Promise from Context 1 is LOST!                       │
│       │   .then() never executes                                │
│       │                                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Решение

Сохранять `dealId` в localStorage **ДО** отправки транзакции, а не после. Когда пользователь возвращается в приложение — проверять localStorage и показывать "Проверка оплаты".

```text
┌─────────────────────────────────────────────────────────────────┐
│                      ИСПРАВЛЕННЫЙ ФЛОУ                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [App Context 1]                                                │
│       │                                                         │
│       ├── localStorage.set('pending_payments', [dealId])        │
│       ├── sendTransaction() ────────► [Wallet]                  │
│       │                                                         │
│  [App Context 2 - after return]                                 │
│       │                                                         │
│       ├── Deals page loads                                      │
│       ├── Checks localStorage                                   │
│       ├── Shows "Проверка оплаты" for pending deals             │
│       │                                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Техническая реализация

### Файл: `src/components/deals/PaymentDialog.tsx`

Переместить сохранение в localStorage **ДО** вызова `sendTransaction`:

```tsx
const handlePayViaWallet = () => {
  // ... проверки ...
  
  setIsPaying(true);
  
  // НОВОЕ: Сохраняем СРАЗУ, до отправки транзакции
  try {
    const pendingPayments = JSON.parse(localStorage.getItem('pending_payments') || '[]');
    if (!pendingPayments.includes(dealId)) {
      pendingPayments.push(dealId);
      localStorage.setItem('pending_payments', JSON.stringify(pendingPayments));
    }
  } catch {}
  
  // ... подготовка transaction ...
  
  tonConnectUI.sendTransaction(transaction, options)
    .then(() => {
      // Закрываем диалог и перенаправляем
      onOpenChange(false);
      onPaymentSuccess?.();
      navigate('/deals');
      toast.success("Транзакция отправлена! Проверяем оплату...");
    })
    .catch((error: any) => {
      // НОВОЕ: Удаляем из localStorage при ошибке
      try {
        const pendingPayments = JSON.parse(localStorage.getItem('pending_payments') || '[]');
        const updated = pendingPayments.filter((pid: string) => pid !== dealId);
        localStorage.setItem('pending_payments', JSON.stringify(updated));
      } catch {}
      
      // ... обработка ошибок ...
    });
    
  // НОВОЕ: Для внешних кошельков — редирект сразу после открытия ссылки
  if (walletLink) {
    openWalletLink(walletLink);
    // Сразу перенаправляем на deals, т.к. Promise может не resolve'иться
    setTimeout(() => {
      onOpenChange(false);
      navigate('/deals');
    }, 1000);
  }
};
```

---

### Файл: `src/components/DealCard.tsx`

Логика уже правильная — проверяет localStorage и показывает "Проверка оплаты".

Нужно добавить очистку при истечении срока (если транзакция не прошла):

```tsx
// Очистка из localStorage если сделка истекла
useEffect(() => {
  if (status === 'expired' || status === 'cancelled') {
    try {
      const pendingPayments = JSON.parse(localStorage.getItem('pending_payments') || '[]');
      const updated = pendingPayments.filter((pid: string) => pid !== id);
      localStorage.setItem('pending_payments', JSON.stringify(updated));
    } catch {}
  }
}, [status, id]);
```

---

### Файл: `src/pages/Deals.tsx`

Автообновление уже реализовано. Добавим проверку при загрузке страницы:

```tsx
// При загрузке страницы проверяем pending_payments
useEffect(() => {
  let pendingPayments: string[] = [];
  try {
    pendingPayments = JSON.parse(localStorage.getItem('pending_payments') || '[]');
  } catch {}
  
  if (pendingPayments.length === 0) return;
  
  // Запускаем refetch сразу и каждые 5 секунд
  refetch();
  
  const interval = setInterval(() => {
    refetch();
  }, 5000);
  
  return () => clearInterval(interval);
}, [refetch]);
```

---

## Ключевые изменения

| Аспект | Было | Стало |
|--------|------|-------|
| Когда сохраняется в localStorage | После `.then()` | До `sendTransaction()` |
| При ошибке | Ничего | Удаляется из localStorage |
| Для внешних кошельков | Ждём Promise | Редирект через 1 сек |
| При expired/cancelled | Ничего | Очищается из localStorage |

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/components/deals/PaymentDialog.tsx` | Сохранение в localStorage ДО транзакции, редирект для внешних кошельков |
| `src/components/DealCard.tsx` | Очистка при expired/cancelled статусах |
| `src/pages/Deals.tsx` | Немедленный refetch при загрузке с pending_payments |

