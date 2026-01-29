
# Исправление bounce-проблемы с неинициализированным эскроу-кошельком

## Проблема

При оплате на эскроу-адрес транзакция возвращается (bounce) потому что:
- Адрес кошелька вычислен, но контракт ещё не развёрнут в блокчейне
- По умолчанию TonConnect использует `bounce: true`
- TON сеть возвращает средства, если получатель "пустой"

## Решение

Применяем **оба способа** для максимальной надёжности:

### 1. Frontend: добавить `bounce: false` в транзакцию

В компонентах `PaymentStep.tsx` и `PaymentDialog.tsx` добавить флаг:

```typescript
const transaction = {
  validUntil: Math.floor(Date.now() / 1000) + 600,
  messages: [
    {
      address: escrowAddress,
      amount: amountNano,
      bounce: false  // <-- Разрешить отправку на неинициализированный адрес
    }
  ]
};
```

### 2. Backend: генерировать Non-bounceable адрес (UQ...)

В `create-deal/index.ts` изменить формат адреса:

```typescript
// Было:
const address = wallet.address.toString({
  bounceable: true,  // EQ...
  testOnly: false,
});

// Станет:
const address = wallet.address.toString({
  bounceable: false,  // UQ...
  testOnly: false,
});
```

Адреса `UQ...` автоматически сигнализируют кошелькам, что нужно использовать `bounce: false`.

## Изменяемые файлы

| Файл | Изменение |
|------|-----------|
| `src/components/channel/PaymentStep.tsx` | Добавить `bounce: false` в сообщение транзакции |
| `src/components/deals/PaymentDialog.tsx` | Добавить `bounce: false` в сообщение транзакции |
| `supabase/functions/create-deal/index.ts` | Генерировать адрес с `bounceable: false` (формат UQ) |

## Важный нюанс

Существующие сделки с адресами `EQ...` продолжат работать благодаря `bounce: false` на фронтенде. Новые сделки будут создаваться с адресами `UQ...` для дополнительной совместимости.

## Результат

После исправления:
- Транзакции не будут возвращаться
- Средства останутся на эскроу-кошельке
- Система проверки оплаты (`check-escrow-payments`) обнаружит баланс и переведёт сделку в статус `escrow`
