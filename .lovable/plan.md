

## Обзор

Сейчас при добавлении канала MTProto-статистика не запрашивается, а `refresh-channel-stats` срабатывает только если данные старше 24 часов. Для @slixone `stats_updated_at` = сегодня, поэтому MTProto не вызывается и все расширенные поля (`language_stats`, `growth_rate`, `top_hours`, `premium_percentage`) остаются `null`.

---

## Изменения

### 1. verify-channel: Вызов MTProto при добавлении канала

После успешного создания канала вызываем `mtproto-channel-stats` и сразу сохраняем расширенную статистику:

```typescript
// После создания канала (строка ~487)
// Fetch MTProto stats immediately for new channels with 500+ subscribers
if (subscribersCount >= 500) {
  try {
    const mtprotoResponse = await fetch(
      `${supabaseUrl}/functions/v1/mtproto-channel-stats`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: chat.username }),
      }
    );
    const mtprotoData = await mtprotoResponse.json();
    
    if (mtprotoData.success && mtprotoData.stats) {
      // Update channel with MTProto stats
      await supabase
        .from("channels")
        .update({
          language_stats: mtprotoData.stats.languageStats || null,
          growth_rate: mtprotoData.stats.followers?.growthRate || null,
          notifications_enabled: mtprotoData.stats.enabledNotifications?.part || null,
          top_hours: mtprotoData.stats.topHours || null,
          premium_percentage: mtprotoData.stats.premiumPercentage || null,
        })
        .eq("id", newChannel.id);
    }
  } catch (e) {
    console.log("[verify-channel] MTProto stats fetch failed:", e);
  }
}
```

---

### 2. Обновить интерфейс Channel (mockChannels.ts)

Добавить недостающие поля:

```typescript
export interface Channel {
  // ... existing fields ...
  growthRate?: number;        // % роста подписчиков
  notificationsEnabled?: number;  // % включенных уведомлений
  topHours?: Array<{ hour: number; value: number }>;  // Активность по часам
}
```

---

### 3. Обновить useChannels.ts

Добавить маппинг новых полей из БД:

```typescript
function mapDatabaseToChannel(dbChannel: DatabaseChannel): Channel {
  // ... existing mapping ...
  return {
    // ... existing fields ...
    growthRate: dbChannel.growth_rate ?? undefined,
    notificationsEnabled: dbChannel.notifications_enabled ?? undefined,
    topHours: parseTopHours(dbChannel.top_hours),
  };
}
```

---

### 4. Обновить ChannelAnalytics компонент

Добавить отображение реальных данных:

- **Growth Rate** — показывать рост/падение подписчиков за период
- **Top Hours** — тепловая карта активности аудитории по часам
- **Notifications Enabled** — процент аудитории с включенными уведомлениями

```tsx
// Новые пропсы
interface ChannelAnalyticsProps {
  // ... existing props ...
  growthRate?: number;
  notificationsEnabled?: number;
  topHours?: Array<{ hour: number; value: number }>;
}
```

---

### 5. Обновить страницу Channel.tsx

Передать новые данные в ChannelAnalytics:

```tsx
<ChannelAnalytics
  // ... existing props ...
  growthRate={channel.growthRate}
  notificationsEnabled={channel.notificationsEnabled}
  topHours={channel.topHours}
/>
```

---

## Порядок изменений

| # | Файл | Действие |
|---|------|----------|
| 1 | `supabase/functions/verify-channel/index.ts` | Добавить вызов MTProto после создания канала |
| 2 | `src/data/mockChannels.ts` | Расширить интерфейс Channel |
| 3 | `src/hooks/useChannels.ts` | Добавить маппинг новых полей |
| 4 | `src/components/channel/ChannelAnalytics.tsx` | Добавить секции: Growth Rate, Top Hours, Notifications |
| 5 | `src/pages/Channel.tsx` | Передать новые данные в компонент |

---

## Что отобразим в аналитике

| Метрика | Источник | Описание |
|---------|----------|----------|
| Language Stats | MTProto | Языки аудитории с процентами |
| Premium % | MTProto | Доля Premium-подписчиков |
| Growth Rate | MTProto | Рост/падение за период |
| Notifications | MTProto | % с включенными уведомлениями |
| Top Hours | MTProto | Часы максимальной активности |

---

## Для @slixone

Для уже добавленных каналов можно:
1. Вручную вызвать `refresh-channel-stats` с параметром force
2. Или изменить `stats_updated_at` на старую дату, чтобы lazy-update сработал

