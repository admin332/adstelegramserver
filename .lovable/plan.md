
# Исправление ошибки TonConnect SDK при оплате

## Проблема

После добавления `bounce: false` в объект сообщения транзакции, TonConnect SDK выбрасывает ошибку `BadRequestError`. Это происходит потому что параметр `bounce` **не входит в официальный интерфейс** `SendTransactionRequest`.

Согласно типам SDK, сообщение поддерживает только:
- `address` — адрес получателя
- `amount` — сумма в nanoTon
- `stateInit` — данные контракта
- `payload` — полезная нагрузка
- `extraCurrency` — дополнительные валюты

## Как TonConnect определяет bounce-флаг

Кошельки (Tonkeeper, MyTonWallet и др.) автоматически определяют bounce на основе **формата адреса**:

| Формат | Префикс | Bounce |
|--------|---------|--------|
| Bounceable | `EQ...` | `true` |
| Non-bounceable | `UQ...` | `false` |

Мы уже генерируем адреса в формате `UQ...` на бэкенде — этого достаточно!

## Решение

Убрать параметр `bounce: false` из объекта сообщения транзакции на фронтенде. Кошелёк автоматически определит `bounce: false` по адресу `UQ...`.

### Изменения в файлах

**src/components/channel/PaymentStep.tsx**
```typescript
// Было:
{
  address: escrowAddress,
  amount: amountNano,
  bounce: false, // Разрешить отправку на неинициализированный эскроу-адрес
} as any,

// Станет:
{
  address: escrowAddress,
  amount: amountNano,
},
```

**src/components/deals/PaymentDialog.tsx**
```typescript
// Было:
{
  address: escrowAddress,
  amount: amountNano,
  bounce: false, // Разрешить отправку на неинициализированный эскроу-адрес
} as any,

// Станет:
{
  address: escrowAddress,
  amount: amountNano,
},
```

## Почему это работает

1. Бэкенд (`create-deal`) уже генерирует адреса в формате `UQ...` (`bounceable: false`)
2. Кошелёк видит `UQ...` адрес и автоматически отправляет транзакцию с `bounce: false`
3. Средства успешно зачисляются на неинициализированный эскроу-кошелёк

## Проверка после исправления

1. Создать новую сделку — адрес должен начинаться с `UQ`
2. Нажать "Оплатить" — Tonkeeper откроется без ошибок
3. Подтвердить транзакцию — средства останутся на эскроу
