

## Проблема

Когда админ меняет статус сделки на "Оплачено" (escrow) через админ-панель, владельцу канала не отправляется уведомление с предпросмотром рекламы и кнопками одобрения/отклонения.

### Почему так происходит

Текущий код в `AdminDealsTable.tsx` (строки 103-128) просто обновляет статус в базе данных:

```typescript
const { error } = await supabase
  .from('deals')
  .update({ status: newStatus })
  .eq('id', dealId);
```

А логика отправки уведомлений (`sendPaymentNotification`) находится только в edge function `check-escrow-payments`, которая вызывается автоматически при обнаружении платежа.

## Решение

Создать новую edge function `notify-deal-payment`, которая будет отправлять уведомление владельцу канала. Вызывать её из админ-панели при смене статуса на `escrow`.

## Изменения

### 1. Создать новую edge function `notify-deal-payment`

```text
supabase/functions/notify-deal-payment/index.ts
```

Эта функция будет:
- Принимать `dealId` в теле запроса
- Загружать данные сделки с каналом, кампанией и владельцем
- Отправлять предпросмотр кампании и уведомление с кнопками в Telegram

Логика отправки будет скопирована из `check-escrow-payments`:
- `sendCampaignPreview()` — отправка медиа и текста рекламы
- `sendPaymentNotification()` — уведомление с суммой и кнопками Одобрить/Отклонить

### 2. Обновить `AdminDealsTable.tsx`

При смене статуса на `escrow` дополнительно вызывать edge function:

```typescript
const updateStatus = async (dealId: string, newStatus: DealStatus) => {
  // ...обновление статуса...
  
  // Если новый статус "escrow" - отправить уведомление владельцу
  if (newStatus === 'escrow') {
    await supabase.functions.invoke('notify-deal-payment', {
      body: { dealId }
    });
  }
};
```

### 3. Обновить `config.toml`

Добавить конфигурацию для новой функции:

```toml
[functions.notify-deal-payment]
verify_jwt = false
```

## Структура edge function

```typescript
// notify-deal-payment/index.ts

serve(async (req) => {
  const { dealId } = await req.json();
  
  // 1. Загрузить сделку с нужными данными
  const { data: deal } = await supabase
    .from('deals')
    .select(`
      id, total_price, posts_count, duration_hours, scheduled_at,
      campaign:campaigns(text, media_urls, button_text, button_url),
      channel:channels(
        id, title,
        owner:users!channels_owner_id_fkey(telegram_id)
      )
    `)
    .eq('id', dealId)
    .single();
  
  // 2. Отправить предпросмотр кампании
  await sendCampaignPreview(ownerTelegramId, deal.campaign);
  
  // 3. Отправить уведомление с кнопками
  await sendPaymentNotification(deal);
  
  return { success: true };
});
```

## Файлы для создания/изменения

| Файл | Действие |
|------|----------|
| `supabase/functions/notify-deal-payment/index.ts` | Создать |
| `supabase/config.toml` | Добавить конфигурацию функции |
| `src/components/admin/AdminDealsTable.tsx` | Добавить вызов функции при смене на `escrow` |

## Результат

После изменения:
- Админ меняет статус на "Оплачено" → владелец получает:
  1. Предпросмотр рекламного поста (медиа + текст + кнопка)
  2. Уведомление с деталями сделки и кнопками "Одобрить" / "Отклонить"
- Поведение идентично автоматическому обнаружению платежа

