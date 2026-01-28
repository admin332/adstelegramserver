
# Замена "Рейтинг" на "Оборот" в профиле

## Обзор

Заменяем второй блок статистики "Рейтинг" на "Оборот" — сумму всех завершённых сделок пользователя в TON.

## Текущий вид

```
┌─────────────────┐  ┌─────────────────┐
│ ★ Сделок        │  │ ★ Рейтинг       │
│ 12              │  │ 4.8             │
└─────────────────┘  └─────────────────┘
```

## Новый вид

```
┌─────────────────┐  ┌─────────────────┐
│ ★ Сделок        │  │ 💰 Оборот       │
│ 12              │  │ 150 TON         │
└─────────────────┘  └─────────────────┘
```

## Изменения

### 1. Edge Function: user-advertiser-stats

**Файл:** `supabase/functions/user-advertiser-stats/index.ts`

Добавить расчёт оборота — суммы `total_price` всех завершённых сделок:

```typescript
// Получаем сумму total_price для завершённых сделок
const { data: dealsData } = await supabase
  .from("deals")
  .select("total_price")
  .eq("advertiser_id", user.id)
  .eq("status", "completed");

let totalTurnover = 0;
if (dealsData && dealsData.length > 0) {
  totalTurnover = dealsData.reduce((acc, d) => acc + (Number(d.total_price) || 0), 0);
}

return new Response(
  JSON.stringify({
    completed_deals: completedDeals || 0,
    avg_rating: avgRating,
    total_turnover: totalTurnover,  // ← НОВОЕ ПОЛЕ
  }),
  ...
);
```

### 2. Хук: useAdvertiserStats

**Файл:** `src/hooks/useAdvertiserStats.ts`

Добавить поле `totalTurnover` в интерфейс и парсинг:

```typescript
interface AdvertiserStats {
  completedDeals: number;
  avgRating: number;
  totalTurnover: number;  // ← НОВОЕ ПОЛЕ
}

// В setStats:
setStats({
  completedDeals: data?.completed_deals ?? 0,
  avgRating: data?.avg_rating ?? 0,
  totalTurnover: data?.total_turnover ?? 0,  // ← НОВОЕ
});
```

### 3. Страница профиля

**Файл:** `src/pages/Profile.tsx`

#### 3.1 Обновить демо-данные:

```typescript
const demoStats = {
  completedDeals: 12,
  totalTurnover: 150,  // ← Заменить avgRating
};
```

#### 3.2 Добавить импорт иконки:

```typescript
import { Wallet } from "lucide-react";
```

#### 3.3 Заменить блок статистики "Рейтинг":

```tsx
// Было:
<StatsCard
  icon={<Star className="w-5 h-5" />}
  label="Рейтинг"
  value={statsLoading ? "..." : String(isTestMode ? demoStats.avgRating : (advertiserStats?.avgRating ?? 0))}
/>

// Станет:
<StatsCard
  icon={<Wallet className="w-5 h-5" />}
  label="Оборот"
  value={statsLoading ? "..." : `${isTestMode ? demoStats.totalTurnover : (advertiserStats?.totalTurnover ?? 0)} TON`}
/>
```

## Технические детали

| Поле | Источник | Описание |
|------|----------|----------|
| `total_turnover` | `SUM(deals.total_price)` | Сумма всех `completed` сделок пользователя |

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `supabase/functions/user-advertiser-stats/index.ts` | Добавить расчёт `total_turnover` |
| `src/hooks/useAdvertiserStats.ts` | Добавить поле `totalTurnover` в интерфейс |
| `src/pages/Profile.tsx` | Заменить "Рейтинг" на "Оборот" в StatsCard |

## Примечание

Рейтинг пользователя (звёздочка с числом) останется в карточке пользователя выше — в строке с именем и статусом "Проверен".
