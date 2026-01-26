

## Задача

Скрыть от владельцев каналов сделки со статусами "pending" (ожидает оплаты) и "expired" (истекло), так как они не требуют действий от владельца.

## Текущее поведение

В `user-deals/index.ts` (строки 158-178) все сделки трансформируются и возвращаются без фильтрации по статусу:

```typescript
const transformedDeals = deals?.map((deal) => {
  const isChannelOwner = userChannelIds.includes(deal.channel_id) && deal.advertiser_id !== userId;
  const role = isChannelOwner ? "channel_owner" : "advertiser";
  return { ...deal, role };
}) || [];
```

## Решение

Добавить фильтрацию после трансформации: исключать сделки со статусами `pending` и `expired` для роли `channel_owner`.

## Изменение в `supabase/functions/user-deals/index.ts`

Заменить строки 158-178:

```typescript
// Statuses to hide from channel owners (they don't need to act on these)
const hiddenStatusesForOwner = ['pending', 'expired'];

// Transform deals with role info
const transformedDeals = deals?.map((deal) => {
  const isChannelOwner = userChannelIds.includes(deal.channel_id) && deal.advertiser_id !== userId;
  const role = isChannelOwner ? "channel_owner" : "advertiser";

  return {
    id: deal.id,
    status: deal.status,
    total_price: deal.total_price,
    posts_count: deal.posts_count,
    duration_hours: deal.duration_hours,
    escrow_address: deal.escrow_address,
    scheduled_at: deal.scheduled_at,
    created_at: deal.created_at,
    expires_at: deal.expires_at,
    channel: deal.channel,
    campaign: deal.campaign,
    role,
    advertiser: isChannelOwner ? advertisersMap[deal.advertiser_id] : undefined,
  };
}).filter((deal) => {
  // Hide pending/expired deals from channel owners
  if (deal.role === 'channel_owner' && hiddenStatusesForOwner.includes(deal.status)) {
    return false;
  }
  return true;
}) || [];
```

## Логика фильтрации

| Статус | Рекламодатель | Владелец канала |
|--------|---------------|-----------------|
| `pending` | ✅ Видит (нужно оплатить) | ❌ Скрыто |
| `expired` | ✅ Видит (история) | ❌ Скрыто |
| `escrow` | ✅ Видит | ✅ Видит (нужно одобрить) |
| `in_progress` | ✅ Видит | ✅ Видит |
| `completed` | ✅ Видит | ✅ Видит |
| `cancelled` | ✅ Видит | ✅ Видит |
| `disputed` | ✅ Видит | ✅ Видит |

## Файл для изменения

| Файл | Действие |
|------|----------|
| `supabase/functions/user-deals/index.ts` | Добавить фильтрацию по статусу для роли `channel_owner` |

## Результат

После изменения владельцы каналов будут видеть только релевантные сделки:
- `escrow` — требует одобрения/отклонения
- `in_progress` — реклама публикуется
- `completed` — завершённые сделки
- `cancelled` / `disputed` — проблемные сделки

Сделки `pending` и `expired` не будут отображаться, так как они не требуют действий от владельца канала.

