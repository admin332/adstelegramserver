

# Исправление статистики профиля: учёт обеих ролей пользователя

## Проблема

Текущая функция `user-advertiser-stats` считает статистику **только для рекламодателей** — она ищет сделки, где `advertiser_id = user.id`. 

Но один человек может выступать в двух ролях:
1. **Рекламодатель** — покупает рекламу (траты)
2. **Владелец канала** — продаёт рекламу (доход)

Сейчас владельцы каналов видят `0 сделок` и `0 TON оборота`, хотя участвовали в сделках.

## Решение

Расширить Edge Function `user-advertiser-stats` для подсчёта:
1. Сделок, где пользователь — **рекламодатель** (`advertiser_id`)
2. Сделок, где пользователь — **владелец канала** (через `channel_admins` или `channels.owner_id`)

Суммировать оба типа сделок в общий оборот и количество.

## Техническое изменение

### Файл: `supabase/functions/user-advertiser-stats/index.ts`

**Новая логика:**

```typescript
// 1. Получаем список каналов пользователя
const { data: channelAdmins } = await supabase
  .from("channel_admins")
  .select("channel_id")
  .eq("user_id", user.id);

const userChannelIds = channelAdmins?.map((ca) => ca.channel_id) || [];

// 2. Считаем сделки как рекламодатель
const { count: advertiserDeals } = await supabase
  .from("deals")
  .select("*", { count: "exact", head: true })
  .eq("advertiser_id", user.id)
  .eq("status", "completed");

// 3. Считаем сделки как владелец канала
let ownerDeals = 0;
if (userChannelIds.length > 0) {
  const { count } = await supabase
    .from("deals")
    .select("*", { count: "exact", head: true })
    .in("channel_id", userChannelIds)
    .neq("advertiser_id", user.id) // Исключаем дубли
    .eq("status", "completed");
  ownerDeals = count || 0;
}

// 4. Суммируем
const completedDeals = (advertiserDeals || 0) + ownerDeals;

// 5. Аналогично для оборота
// - Траты (как рекламодатель)
// - Доход (как владелец канала)
// - Общий оборот = сумма
```

### Также учитываем рейтинг

Добавляем средний рейтинг из отзывов на каналы (таблица `reviews`), объединяя с рейтингом как рекламодателя.

## Что изменится в UI

На странице профиля:
- **Сделок** — будет показывать сумму сделок в обеих ролях
- **Оборот** — будет показывать общий оборот (траты + доходы)

## Переименование

Так как статистика теперь не только для рекламодателей, предлагаю:
- Переименовать хук: `useAdvertiserStats` → `useUserStats`
- Переименовать функцию: `user-advertiser-stats` → `user-stats`

Или оставить как есть для обратной совместимости.

## Изменяемые файлы

1. **`supabase/functions/user-advertiser-stats/index.ts`** — расширить логику подсчёта для обеих ролей
2. **`src/hooks/useAdvertiserStats.ts`** — без изменений (интерфейс остаётся тот же)
3. **`src/pages/Profile.tsx`** — без изменений (данные уже отображаются)

