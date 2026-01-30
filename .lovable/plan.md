

## Обзор

После обновления VPS-сервиса на Railway, формат данных изменился. Нужно адаптировать Edge Functions и фронтенд для корректной обработки нового формата.

---

## Изменения в формате данных VPS

| Поле | Было | Стало |
|------|------|-------|
| **notifications** | `enabledNotifications.part` (число) | `notificationsRaw: { part, total }` |
| **languages** | `languageStats: []` (пустой) | `languageStats: [{ label, value }, ...]` |
| **growth** | `followers.growthRate` | `growthRate` (напрямую) |
| **premium** | `premiumPercentage` (undefined) | `premiumStats: [{ x, y0 }, ...]` (график) |
| **topHours** | `topHours: [{ hour, value }]` | `topHours: [{ x, y0 }, ...]` (формат графика) |

---

## Изменения

### 1. verify-channel/index.ts (строки 504-536)

Адаптировать парсинг нового формата:

```typescript
if (mtprotoData.success && mtprotoData.stats) {
  const stats = mtprotoData.stats;
  const updateData: Record<string, unknown> = {};
  
  // Language stats: новый формат { label, value } → { language, percentage }
  if (stats.languageStats && Array.isArray(stats.languageStats) && stats.languageStats.length > 0) {
    const totalLang = stats.languageStats.reduce((sum, l) => sum + (l.value || 0), 0);
    updateData.language_stats = stats.languageStats.map(l => ({
      language: l.label || 'Unknown',
      percentage: totalLang > 0 ? Math.round((l.value / totalLang) * 100) : 0
    }));
  }
  
  // Growth rate: теперь напрямую
  if (stats.growthRate !== undefined) {
    updateData.growth_rate = stats.growthRate;
  }
  
  // Notifications: новый формат с part/total для точного расчета %
  if (stats.notificationsRaw) {
    const { part, total } = stats.notificationsRaw;
    const percentage = total > 0 ? Math.round((part / total) * 10000) / 100 : 0;
    updateData.notifications_enabled = percentage;
  }
  
  // Top hours: формат графика { x, y0 } → { hour, value }
  if (stats.topHours && Array.isArray(stats.topHours) && stats.topHours.length > 0) {
    updateData.top_hours = stats.topHours.map((h, idx) => ({
      hour: idx,
      value: h.y0 || h['y0'] || 0
    }));
  }
  
  // Premium stats: это график активности, не процент подписчиков
  // Можно сохранить для будущего отображения
  if (stats.premiumStats && Array.isArray(stats.premiumStats)) {
    // Пока не сохраняем - это данные графика, не % премиум подписчиков
  }
  
  // ... остальной код сохранения
}
```

---

### 2. refresh-channel-stats/index.ts (строки 331-355)

Аналогичные изменения для обработки нового формата:

```typescript
if (mtprotoData.stats) {
  // Languages: { label, value } → { language, percentage }
  if (mtprotoData.stats.languageStats?.length > 0) {
    const total = mtprotoData.stats.languageStats.reduce((s, l) => s + (l.value || 0), 0);
    languageStats = mtprotoData.stats.languageStats.map(l => ({
      language: l.label || 'Unknown',
      percentage: total > 0 ? Math.round((l.value / total) * 100) : 0
    }));
  }
  
  // Growth rate: теперь напрямую
  if (mtprotoData.stats.growthRate !== undefined) {
    growthRate = mtprotoData.stats.growthRate;
  }
  
  // Notifications: part/total → percentage
  if (mtprotoData.stats.notificationsRaw) {
    const { part, total } = mtprotoData.stats.notificationsRaw;
    notificationsEnabled = total > 0 ? Math.round((part / total) * 10000) / 100 : 0;
  }
  
  // Top hours: { x, y0 } → { hour, value }
  if (mtprotoData.stats.topHours?.length > 0) {
    topHours = mtprotoData.stats.topHours.map((h, idx) => ({
      hour: idx,
      value: h.y0 || h['y0'] || 0
    }));
  }
}
```

---

### 3. ChannelAnalytics.tsx

Добавить защиту от некорректных значений:

```typescript
// Строка 218-226: ограничить до 100%
const safeNotifications = Math.min(notificationsEnabled ?? 0, 100);
// Использовать safeNotifications вместо notificationsEnabled в анимации
```

---

### 4. Обновить данные @slixone

После деплоя Edge Functions вызвать `refresh-channel-stats` принудительно для @slixone:
- Сбросить `stats_updated_at` на старую дату чтобы lazy-update сработал
- Или вызвать напрямую с параметром force

---

## Порядок действий

| # | Файл | Действие |
|---|------|----------|
| 1 | `supabase/functions/verify-channel/index.ts` | Адаптировать парсинг нового формата VPS |
| 2 | `supabase/functions/refresh-channel-stats/index.ts` | Адаптировать парсинг нового формата VPS |
| 3 | `src/components/channel/ChannelAnalytics.tsx` | Добавить защиту от >100% |
| 4 | База данных | Сбросить stats_updated_at для @slixone |

---

## Итоговый формат данных в БД

| Поле | Формат | Пример |
|------|--------|--------|
| `notifications_enabled` | `number` (процент 0-100) | `4.69` |
| `language_stats` | `[{ language, percentage }]` | `[{ "language": "Russian", "percentage": 75 }]` |
| `growth_rate` | `number` (процент) | `-0.23` |
| `top_hours` | `[{ hour, value }]` | `[{ "hour": 0, "value": 5 }, ...]` |

