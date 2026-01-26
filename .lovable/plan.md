

## Цель
Реализовать стратегию "Lazy Update" — автоматическое обновление статистики канала (подписчики, описание, аватар) при открытии карточки, если данные старше 24 часов.

## Архитектура решения

```text
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Channel Page   │────►│ refresh-channel-stats│────►│  Telegram API   │
│  (Frontend)     │     │  (Edge Function)     │     │ getChatMemberCount│
└─────────────────┘     └──────────────────────┘     │ getChat          │
         │                        │                   └─────────────────┘
         │                        ▼
         │              ┌──────────────────────┐
         └──────────────│     channels DB      │
                        │ stats_updated_at     │
                        └──────────────────────┘
```

## Этапы реализации

### 1. Миграция базы данных

Добавить новую колонку `stats_updated_at` в таблицу `channels`:

```sql
-- Добавить колонку для отслеживания последнего обновления статистики
ALTER TABLE public.channels 
ADD COLUMN stats_updated_at TIMESTAMPTZ DEFAULT now();

-- Установить текущее время для существующих записей
UPDATE public.channels 
SET stats_updated_at = updated_at 
WHERE stats_updated_at IS NULL;
```

### 2. Создать Edge Function `refresh-channel-stats`

**Файл**: `supabase/functions/refresh-channel-stats/index.ts`

Логика функции:
1. Принимает `channel_id`
2. Проверяет `stats_updated_at` — если меньше 24 часов, возвращает "no update needed"
3. Получает `telegram_chat_id` из базы
4. Запрашивает Telegram API:
   - `getChatMemberCount` — количество подписчиков
   - `getChat` — описание, аватар, название
5. Обновляет канал в БД:
   - `subscribers_count`
   - `description`
   - `title`
   - `avatar_url`
   - `stats_updated_at = now()`
6. Возвращает обновлённые данные

```typescript
interface RefreshResponse {
  success: boolean;
  updated: boolean;
  channel?: {
    subscribers_count: number;
    description: string | null;
    title: string | null;
    avatar_url: string | null;
    stats_updated_at: string;
  };
  error?: string;
}
```

### 3. Обновить `useChannel` хук

**Файл**: `src/hooks/useChannels.ts`

Добавить логику для триггера обновления:

```typescript
export function useChannel(id: string | undefined) {
  const queryClient = useQueryClient();
  
  // Основной запрос данных канала
  const channelQuery = useQuery({
    queryKey: ['channel', id],
    queryFn: async () => {
      // ... существующая логика
    },
    enabled: !!id,
  });

  // Эффект для проверки и обновления статистики
  useEffect(() => {
    if (!channelQuery.data || !id) return;
    
    const statsUpdatedAt = new Date(channelQuery.data.statsUpdatedAt || 0);
    const hoursAgo = (Date.now() - statsUpdatedAt.getTime()) / (1000 * 60 * 60);
    
    if (hoursAgo > 24) {
      // Вызвать refresh-channel-stats
      refreshChannelStats(id).then((updated) => {
        if (updated) {
          queryClient.invalidateQueries({ queryKey: ['channel', id] });
        }
      });
    }
  }, [channelQuery.data, id]);

  return channelQuery;
}
```

### 4. Добавить интерфейс `DatabaseChannel`

Расширить интерфейс для включения `stats_updated_at`:

```typescript
interface DatabaseChannel {
  // ... существующие поля
  stats_updated_at: string | null;
}
```

### 5. Регистрация функции

**Файл**: `supabase/config.toml`

```toml
[functions.refresh-channel-stats]
verify_jwt = false
```

## Детали Edge Function

### Проверка свежести данных

```typescript
// Проверить, нужно ли обновление
const statsUpdatedAt = new Date(channel.stats_updated_at || 0);
const hoursAgo = (Date.now() - statsUpdatedAt.getTime()) / (1000 * 60 * 60);

if (hoursAgo < 24) {
  return new Response(
    JSON.stringify({ success: true, updated: false }),
    { headers: corsHeaders }
  );
}
```

### Запросы к Telegram API

```typescript
// Получить количество подписчиков
const subscribersCount = await getChatMemberCount(botToken, telegramChatId);

// Получить информацию о канале
const chatInfo = await getChat(botToken, telegramChatId);

// Получить URL аватара
let avatarUrl = null;
if (chatInfo?.photo?.big_file_id) {
  avatarUrl = await getFileUrl(botToken, chatInfo.photo.big_file_id);
}
```

### Обновление в БД

```typescript
await supabase
  .from("channels")
  .update({
    subscribers_count: subscribersCount,
    description: chatInfo?.description || null,
    title: chatInfo?.title || null,
    avatar_url: avatarUrl,
    stats_updated_at: new Date().toISOString(),
  })
  .eq("id", channelId);
```

## UX-оптимизация

- Обновление происходит **фоново** — пользователь сразу видит текущие данные
- После обновления данные автоматически обновятся на странице через `invalidateQueries`
- Без блокирующих запросов — страница загружается мгновенно

## Безопасность

- Функция публичная (без auth), но только читает данные из Telegram
- Защита от злоупотреблений: проверка 24-часового интервала происходит на сервере
- Rate limiting встроен — если данные свежие, Telegram API не вызывается

## Результат

- Данные каналов автоматически актуализируются при просмотре
- Нет нагрузки на Telegram API для свежих данных
- Рекламодатели видят актуальное количество подписчиков
- Владельцы каналов не должны вручную обновлять статистику

