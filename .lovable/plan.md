

## Задача

Исправить логику статусов для опубликованных постов:

1. **После публикации** — статус остаётся `in_progress`, `posted_at` заполняется, отображается "Опубликовано" с таймером "до завершения"
2. **После истечения duration_hours** — статус становится `completed`, отображается "Завершено"

## Текущая проблема

```typescript
// publish-scheduled-posts/index.ts — строки 209-215
.update({
  status: "completed",  // ← ОШИБКА: сразу ставится completed
  posted_at: new Date().toISOString(),
})
```

Это означает что:
- Таймер "до завершения" никогда не показывается (статус сразу completed)
- Нет промежуточного состояния "Опубликовано"

## Решение

### Часть 1: Исправить publish-scheduled-posts

Оставлять статус `in_progress` после публикации:

```typescript
// supabase/functions/publish-scheduled-posts/index.ts — строки 209-215
.update({
  status: "in_progress",  // ← Оставляем in_progress
  posted_at: new Date().toISOString(),
})
```

### Часть 2: Создать Edge Function complete-posted-deals

Новая функция для завершения сделок, где время размещения истекло:

```typescript
// supabase/functions/complete-posted-deals/index.ts

// Логика:
// 1. Найти deals со статусом in_progress где posted_at IS NOT NULL
// 2. Для каждой проверить: posted_at + duration_hours < NOW()
// 3. Если да → обновить статус на completed, отправить уведомления
```

### Часть 3: Добавить cron job

Запускать проверку завершения раз в час:

```sql
SELECT cron.schedule(
  'complete-posted-deals',
  '15 * * * *', -- каждый час в :15
  $$
  SELECT net.http_post(
    url:='https://fdxyittddmpyhaiijddp.supabase.co/functions/v1/complete-posted-deals',
    headers:='{"Authorization": "Bearer ANON_KEY", "Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);
```

### Часть 4: Обновить UI — разделить "Публикуется" и "Опубликовано"

```typescript
// DealCard.tsx — statusConfig

in_progress: { 
  label: "Публикуется",  // ← Когда posted_at = null
  ...
},

// Добавить логику динамического определения label:
const statusLabel = status === "in_progress" && postedAt 
  ? "Опубликовано" 
  : config.label;
```

## Файлы для изменения

| Файл | Изменения |
|------|-----------|
| `supabase/functions/publish-scheduled-posts/index.ts` | Не менять статус на completed |
| `supabase/functions/complete-posted-deals/index.ts` | Создать новую функцию |
| `supabase/config.toml` | Зарегистрировать функцию |
| `src/components/DealCard.tsx` | Динамический label для in_progress |
| База данных | Добавить cron job |

## Визуальная схема жизненного цикла

```text
pending ──(оплата)──► escrow ──(одобрение)──► in_progress (posted_at=null)
                                                   │
                                            (публикация cron)
                                                   ▼
                                            in_progress (posted_at=заполнен)
                                            └── "Опубликовано" + таймер "до завершения"
                                                   │
                                            (duration_hours истёк)
                                                   ▼
                                              completed
                                            └── "Завершено"
```

## Отображение в UI

| Статус | posted_at | Отображение | Таймер |
|--------|-----------|-------------|--------|
| pending | - | "Ожидает оплаты" | до истечения срока оплаты |
| escrow | - | "Оплачено" | до публикации |
| in_progress | null | "Публикуется" | до публикации |
| in_progress | filled | "Опубликовано" | до завершения |
| completed | filled | "Завершено" | нет |

## Уведомления при завершении

**Рекламодателю:**
```
✅ Размещение завершено!

Ваша реклама в канале {channelTitle} успешно отработала полный срок ({durationHours}ч).

Средства переведены владельцу канала.
Спасибо за использование Adsingo! 🚀
```

**Владельцу канала:**
```
💰 Сделка завершена!

Реклама в канале {channelTitle} успешно отработала.
Средства скоро будут переведены на ваш кошелёк.
```

## Техническая детализация

### SQL для поиска завершённых сделок

```sql
SELECT * FROM deals 
WHERE status = 'in_progress' 
  AND posted_at IS NOT NULL 
  AND posted_at + (duration_hours * INTERVAL '1 hour') < NOW();
```

### Логика complete-posted-deals

```typescript
const now = new Date();

const { data: deals } = await supabase
  .from("deals")
  .select(`
    id, posted_at, duration_hours, total_price,
    escrow_mnemonic_encrypted, escrow_address,
    channel:channels(title, username, owner:users!channels_owner_id_fkey(telegram_id, wallet_address)),
    advertiser:users!deals_advertiser_id_fkey(telegram_id)
  `)
  .eq("status", "in_progress")
  .not("posted_at", "is", null);

for (const deal of deals) {
  const postedAt = new Date(deal.posted_at);
  const completionTime = new Date(postedAt.getTime() + deal.duration_hours * 60 * 60 * 1000);
  
  if (now >= completionTime) {
    // 1. Перевести средства владельцу канала
    // 2. Обновить статус на completed
    // 3. Отправить уведомления
  }
}
```

