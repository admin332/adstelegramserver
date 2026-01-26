

## План: Отображение реальных каналов из базы данных

### Текущая ситуация

Сейчас каналы загружаются из `mockChannels.ts` — статические данные. В базе данных уже есть реальные каналы в таблице `channels`.

### Маппинг полей

| Database (channels) | Interface (Channel) | Примечание |
|---------------------|---------------------|------------|
| id | id | UUID |
| title | name | Название канала |
| username | username | @username |
| avatar_url | avatar | URL аватара |
| subscribers_count | subscribers | Кол-во подписчиков |
| — | avgViews | Нет в БД, нужно добавить |
| category | category | Категория |
| price_1_24 | tonPrice | Цена за 1 пост/24ч в TON |
| — | price | USD цена (можно вычислить) |
| — | rating | Нет в БД, нужно добавить |
| verified | verified | Верифицирован ли |
| — | premium | Нет в БД (опционально) |
| description | description | Описание |
| — | engagement | Нет в БД, нужно добавить |
| — | successfulAds | Нет в БД, нужно добавить |

### Этапы реализации

#### 1. Добавить недостающие поля в таблицу channels

Добавить колонки:
- `avg_views` (integer) — среднее кол-во просмотров
- `rating` (numeric) — рейтинг 0-5
- `engagement` (numeric) — вовлечённость %
- `successful_ads` (integer) — успешных рекламных размещений
- `is_premium` (boolean) — премиум канал

#### 2. Создать хук useChannels

Новый файл `src/hooks/useChannels.ts`:
- Использует React Query для загрузки каналов
- Маппит поля из БД в интерфейс Channel
- Возвращает loading, error и данные

```typescript
export function useChannels() {
  return useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .eq('is_active', true)
        .eq('verified', true);
      
      return data.map(mapDatabaseToChannel);
    }
  });
}
```

#### 3. Создать хук useChannel (для одного канала)

Для страницы `/channel/:id`:

```typescript
export function useChannel(id: string) {
  return useQuery({
    queryKey: ['channel', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      return mapDatabaseToChannel(data);
    }
  });
}
```

#### 4. Обновить страницы

**Index.tsx:**
- Импортировать `useChannels` вместо `mockChannels`
- Добавить состояния loading/error
- Показывать скелетон при загрузке

**Channels.tsx:**
- Аналогичные изменения

**Channel.tsx:**
- Использовать `useChannel(id)` вместо `mockChannels.find()`
- Показывать скелетон при загрузке

#### 5. Fallback на mock данные

Если реальных каналов нет — показывать mock данные с пометкой "демо".

### Изменяемые файлы

| Файл | Изменение |
|------|-----------|
| `src/hooks/useChannels.ts` | Создать (новый) |
| `src/pages/Index.tsx` | Использовать useChannels + fallback |
| `src/pages/Channels.tsx` | Использовать useChannels + fallback |
| `src/pages/Channel.tsx` | Использовать useChannel |

### SQL миграция

```sql
ALTER TABLE public.channels 
  ADD COLUMN IF NOT EXISTS avg_views integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating numeric DEFAULT 4.5,
  ADD COLUMN IF NOT EXISTS engagement numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS successful_ads integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false;
```

### Результат

- Каналы загружаются из базы данных в реальном времени
- При отсутствии реальных каналов показываются демо-данные
- Страница канала работает с реальными данными
- Добавлены все необходимые поля для статистики

