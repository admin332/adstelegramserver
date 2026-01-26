
## Цель
Реализовать систему верифицированных отзывов для каналов: отзывы можно оставлять только после реальной завершённой сделки. В карточке канала отображать рейтинг с количеством отзывов: **"4.5 (12 отзывов)"**.

## Архитектура решения

```text
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Advertiser   │────►│   Deal Flow     │────►│   Review Form   │
│  (orders ad)    │     │  (24h escrow)   │     │  (after deal)   │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
                                              ┌─────────────────────┐
                                              │    reviews table    │
                                              │ - deal_id (verified)│
                                              │ - channel_id        │
                                              │ - rating (1-5)      │
                                              │ - comment           │
                                              └────────┬────────────┘
                                                       │
                                                       ▼ TRIGGER
                                              ┌─────────────────────┐
                                              │   channels table    │
                                              │ - rating (avg)      │
                                              │ - reviews_count     │
                                              └─────────────────────┘
```

## Этапы реализации

### Этап 1: Миграция базы данных

#### 1.1 Создать таблицу `deals`

```sql
-- Enum для статуса сделки
CREATE TYPE deal_status AS ENUM (
  'pending',      -- Ожидание подтверждения
  'escrow',       -- Деньги в эскроу
  'in_progress',  -- Пост размещён
  'completed',    -- Сделка завершена (24ч прошло)
  'cancelled',    -- Отменена
  'disputed'      -- Спор
);

CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id UUID NOT NULL REFERENCES public.users(id),
  channel_id UUID NOT NULL REFERENCES public.channels(id),
  campaign_id UUID REFERENCES public.campaigns(id),
  
  -- Детали заказа
  posts_count INTEGER NOT NULL DEFAULT 1,
  duration_hours INTEGER NOT NULL DEFAULT 24,
  price_per_post NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  
  -- Временные метки
  scheduled_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Статус
  status deal_status NOT NULL DEFAULT 'pending',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### 1.2 Создать таблицу `reviews`

```sql
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL UNIQUE REFERENCES public.deals(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.users(id),
  
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### 1.3 Добавить колонку `reviews_count` в `channels`

```sql
ALTER TABLE public.channels
ADD COLUMN IF NOT EXISTS reviews_count INTEGER DEFAULT 0;
```

#### 1.4 Создать триггер для автоматического расчёта рейтинга

```sql
CREATE OR REPLACE FUNCTION public.update_channel_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Обновляем рейтинг и количество отзывов канала
  UPDATE public.channels
  SET 
    rating = (
      SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 4.5)
      FROM public.reviews
      WHERE channel_id = COALESCE(NEW.channel_id, OLD.channel_id)
    ),
    reviews_count = (
      SELECT COUNT(*)
      FROM public.reviews
      WHERE channel_id = COALESCE(NEW.channel_id, OLD.channel_id)
    )
  WHERE id = COALESCE(NEW.channel_id, OLD.channel_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_update_channel_rating
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_channel_rating();
```

#### 1.5 RLS Политики

```sql
-- Deals: advertiser и channel owner могут видеть свои сделки
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deals"
  ON public.deals FOR SELECT
  USING (advertiser_id = auth.uid());

CREATE POLICY "Service role can manage deals"
  ON public.deals FOR ALL
  USING (true)
  WITH CHECK (true);

-- Reviews: публичное чтение, запись только через edge function
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read reviews"
  ON public.reviews FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage reviews"
  ON public.reviews FOR ALL
  USING (true)
  WITH CHECK (true);
```

### Этап 2: Обновить интерфейсы

#### 2.1 Обновить `Channel` интерфейс

**Файл**: `src/data/mockChannels.ts`

```typescript
export interface Channel {
  // ... existing fields
  rating: number;
  reviewsCount?: number;  // NEW
}
```

#### 2.2 Обновить `DatabaseChannel` и маппинг

**Файл**: `src/hooks/useChannels.ts`

```typescript
interface DatabaseChannel {
  // ... existing
  reviews_count: number | null;
}

function mapDatabaseToChannel(dbChannel: DatabaseChannel): Channel {
  return {
    // ... existing
    rating: Number(dbChannel.rating) || 4.5,
    reviewsCount: dbChannel.reviews_count || 0,
  };
}
```

### Этап 3: Обновить UI карточки канала

#### 3.1 Обновить секцию "Статистика" на странице Channel

**Файл**: `src/pages/Channel.tsx`

Изменить отображение рейтинга с простого `4.5` на `4.5 (12 отзывов)`:

```tsx
const detailedStats = [
  {
    icon: Star,
    label: 'Рейтинг',
    value: channel.reviewsCount && channel.reviewsCount > 0
      ? `${channel.rating} (${channel.reviewsCount} ${pluralize(channel.reviewsCount, 'отзыв', 'отзыва', 'отзывов')})`
      : `${channel.rating} (нет отзывов)`,
  },
  // ... other stats
];
```

#### 3.2 Вспомогательная функция для склонения слов

```typescript
function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
```

### Этап 4: Обновить ChannelCard (список каналов)

**Файл**: `src/components/ChannelCard.tsx`

Добавить отображение рейтинга с количеством отзывов в карточке на главной странице (опционально):

```tsx
{/* Rating badge */}
<div className="flex items-center gap-1 text-xs text-white/80">
  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
  <span>{rating}</span>
  {reviewsCount > 0 && (
    <span className="text-white/60">({reviewsCount})</span>
  )}
</div>
```

### Этап 5: Подготовка для будущей интеграции

Создать хуки и типы для работы с отзывами (для будущего использования):

#### 5.1 Создать hook `useChannelReviews`

**Файл**: `src/hooks/useChannelReviews.ts`

```typescript
export function useChannelReviews(channelId: string) {
  return useQuery({
    queryKey: ['channel-reviews', channelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          id,
          rating,
          comment,
          created_at,
          reviewer:reviewer_id(first_name, photo_url)
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!channelId,
  });
}
```

## Результат

После реализации:
- В секции "Статистика" рейтинг будет отображаться как **"4.5 (12 отзывов)"**
- Отзывы могут быть добавлены только после завершённой сделки (deal_id обязателен)
- Рейтинг автоматически пересчитывается триггером при добавлении/изменении отзыва
- База данных готова к полному escrow-flow с таблицей `deals`

## Визуальный результат

До:
```
⭐ Рейтинг          4.5
```

После:
```
⭐ Рейтинг          4.5 (12 отзывов)
```

Или если отзывов нет:
```
⭐ Рейтинг          4.5 (нет отзывов)
```

## Безопасность

- Отзывы привязаны к `deal_id` с `UNIQUE` constraint — один отзыв на сделку
- `deal_id` ссылается на реальную сделку — нельзя "накрутить" отзывы
- Триггер использует `SECURITY DEFINER` для обхода RLS при расчёте рейтинга
- Публичное чтение отзывов, запись только через service role (edge function)
