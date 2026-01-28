
# План: Реальные данные статистики в профиле

## Обзор

Заменить мок-данные "24 сделки" и "4.9 рейтинг" на реальные данные из базы:
1. Количество успешных сделок (где пользователь — рекламодатель)
2. Средний рейтинг рекламодателя (или 0 если отзывов нет)

## Текущая проблема

1. **Рейтинг рекламодателя не сохраняется** — в `telegram-webhook` при `rate_advertiser` отзыв только подтверждается, но НЕ записывается в базу
2. **Нет таблицы для рейтингов рекламодателей** — нужно создать `advertiser_reviews`
3. **Профиль показывает захардкоженные значения** — "24" и "4.9"

## Архитектура решения

```text
┌─────────────────────────┐
│      Profile.tsx        │
├─────────────────────────┤
│ useAdvertiserStats()    │
│   → completedDeals      │
│   → avgRating           │
└─────────────────────────┘
           │
           ▼
┌─────────────────────────┐
│ user-advertiser-stats   │
│    (новый Edge Fn)      │
├─────────────────────────┤
│ SELECT COUNT(*)         │
│   FROM deals            │
│   WHERE advertiser_id   │
│   AND status=completed  │
├─────────────────────────┤
│ SELECT AVG(rating)      │
│   FROM advertiser_      │
│   reviews               │
│   WHERE advertiser_id   │
└─────────────────────────┘
```

## Шаги реализации

### 1. Создать таблицу advertiser_reviews

Хранит отзывы владельцев каналов о рекламодателях:

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | uuid | PK |
| deal_id | uuid | FK к deals |
| advertiser_id | uuid | FK к users |
| reviewer_id | uuid | Кто оставил (owner) |
| rating | integer | 1-5 |
| created_at | timestamp | Дата |

### 2. Обновить telegram-webhook

Сохранять рейтинг рекламодателя в новую таблицу:
- При `rate_advertiser` → INSERT в `advertiser_reviews`
- Проверка на дубликат отзыва

### 3. Создать Edge Function user-advertiser-stats

Возвращает статистику рекламодателя:
- `completed_deals` — COUNT из deals где status = 'completed'
- `avg_rating` — AVG из advertiser_reviews (или 0)

### 4. Создать хук useAdvertiserStats

Вызывает edge function с initData и возвращает:
```typescript
{
  completedDeals: number;
  avgRating: number;
  isLoading: boolean;
}
```

### 5. Обновить Profile.tsx

Заменить мок-данные на реальные:
```tsx
// Было:
value="24"
value="4.9"

// Станет:
value={stats?.completedDeals || 0}
value={stats?.avgRating || 0}
```

## Изменяемые файлы

| Файл | Действие |
|------|----------|
| База данных | Создать таблицу `advertiser_reviews` с RLS |
| `supabase/functions/telegram-webhook/index.ts` | Сохранять рейтинг рекламодателя |
| `supabase/functions/user-advertiser-stats/index.ts` | **Создать** — получение статистики |
| `src/hooks/useAdvertiserStats.ts` | **Создать** — хук для статистики |
| `src/pages/Profile.tsx` | Использовать реальные данные |

## Логика расчётов

**Количество сделок:**
```sql
SELECT COUNT(*) FROM deals 
WHERE advertiser_id = :userId 
AND status = 'completed'
```

**Средний рейтинг:**
```sql
SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 0) 
FROM advertiser_reviews 
WHERE advertiser_id = :userId
```

## Отображение в UI

| Поле | Значение |
|------|----------|
| Сделок | Реальное число (0 если нет) |
| Рейтинг | Среднее 1-5 или 0 если нет отзывов |

## RLS политики для advertiser_reviews

- **SELECT**: Публичный доступ (отзывы публичны)
- **INSERT/UPDATE**: Только service role (через webhook)

## Тестовый режим

В тестовом режиме показывать демо-данные:
- completedDeals: 12
- avgRating: 4.8
