

## Обновление парсинга статистики в refresh-channel-stats

---

## Что нужно сделать

### 1. Добавить новые колонки в БД

В таблице `channels` нет полей `views_per_post` и `shares_per_post`. Нужно добавить миграцию:

```sql
ALTER TABLE public.channels 
ADD COLUMN IF NOT EXISTS views_per_post numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS shares_per_post numeric DEFAULT NULL;
```

---

### 2. Обновить парсинг topHours (суммирование всех недель)

**Текущая логика (берёт только первый ключ):**
```typescript
const valueKey = Object.keys(h).find(k => k !== 'x');
const value = valueKey ? (Number(h[valueKey]) || 0) : 0;
```

**Новая логика (суммирует все недели):**
```typescript
// Суммируем значения всех недель для каждого часа
const value = Object.entries(h)
  .filter(([key]) => key !== 'x')
  .reduce((sum, [_, val]) => sum + (Number(val) || 0), 0);
return { hour: Number(h.x) || idx, value };
```

**Пример данных от VPS:**
```json
{"x": 21, "Jan 16-22": 55, "Jan 23-29": 11}
```
**Результат:** `{ hour: 21, value: 66 }`

---

### 3. Обновить парсинг premiumStats

VPS теперь отдаёт `premiumStats` (массив точек графика). Нужно извлечь последнее значение как `premium_percentage`:

```typescript
if (mtprotoData.stats.premiumStats?.length > 0) {
  const lastPoint = mtprotoData.stats.premiumStats[mtprotoData.stats.premiumStats.length - 1];
  const valueKey = Object.keys(lastPoint).find(k => k !== 'x');
  if (valueKey) {
    premiumPercentage = Number(lastPoint[valueKey]) || null;
    console.log(`[refresh] Premium percentage: ${premiumPercentage}%`);
  }
}
```

---

### 4. Сохранять viewsPerPost и sharesPerPost

VPS отдаёт их напрямую. Если `null` — используем fallback из парсинга последних 10 постов:

```typescript
// viewsPerPost: если MTProto не отдал — используем наш avgViews
let viewsPerPost = mtprotoData.stats.viewsPerPost;
if (viewsPerPost === null && avgViews > 0) {
  viewsPerPost = avgViews;
  console.log(`[refresh] viewsPerPost fallback to avgViews: ${avgViews}`);
}

let sharesPerPost = mtprotoData.stats.sharesPerPost;
```

---

### 5. Убедиться в корректности расчёта уведомлений

Текущая логика уже правильная:
```typescript
const { part, total } = mtprotoData.stats.notificationsRaw;
notificationsEnabled = total > 0 ? Math.round((part / total) * 10000) / 100 : 0;
```

---

### 6. Убедиться в корректности расчёта языков (проценты)

Текущая логика уже правильная — считает сумму всех значений и делит каждое на неё:
```typescript
const total = mtprotoData.stats.languageStats.reduce((s, l) => s + (l.value || 0), 0);
languageStats = mtprotoData.stats.languageStats.map(l => ({
  language: l.label || 'Unknown',
  percentage: total > 0 ? Math.round((l.value || 0) / total * 100) : 0
}));
```

---

## Итоговые изменения

| Файл | Изменение |
|------|-----------|
| `supabase/migrations/` | Добавить колонки `views_per_post`, `shares_per_post` |
| `refresh-channel-stats/index.ts` | Обновить парсинг `topHours`, добавить `premiumStats`, `viewsPerPost`, `sharesPerPost` |

---

## Техническая информация

### Структура данных от VPS (обновлённый index.js)

```json
{
  "success": true,
  "stats": {
    "languageStats": [{"label": "Russian", "value": 12345}, ...],
    "premiumStats": [{"x": 1737763200000, "Premium": 5.12}, ...],
    "topHours": [{"x": 0, "Jan 16-22": 10, "Jan 23-29": 15}, ...],
    "growthRate": -0.23,
    "notificationsRaw": {"part": 823, "total": 1753},
    "viewsPerPost": 456,
    "sharesPerPost": 12
  }
}
```

### Что будет сохранено в БД

| Поле | Значение |
|------|----------|
| `language_stats` | `[{"language": "Russian", "percentage": 78}, ...]` |
| `premium_percentage` | `5.12` (последняя точка графика) |
| `top_hours` | `[{"hour": 0, "value": 25}, {"hour": 1, "value": 30}, ...]` |
| `growth_rate` | `-0.23` |
| `notifications_enabled` | `46.89` |
| `views_per_post` | `456` или fallback из avgViews |
| `shares_per_post` | `12` |

