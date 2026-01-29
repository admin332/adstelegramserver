
# Интеграция MTProto через Deno Edge Function

## Цель
Получать детальную статистику каналов через MTProto API прямо в Edge Function, используя уже имеющуюся сессию и ключи API.

## Архитектура

```text
┌─────────────────────────────────────────────────────────────┐
│                      Adsingo Frontend                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│            refresh-channel-stats (Edge Function)            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  1. Проверка свежести данных (< 24ч)                │   │
│  │  2. Вызов mtproto-channel-stats                     │   │
│  │  3. Обновление БД                                    │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           mtproto-channel-stats (новая Edge Function)       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  GRM (Deno MTProto client)                          │   │
│  │  - StringSession (сохранённая авторизация)           │   │
│  │  - channels.GetFullChannel                          │   │
│  │  - stats.GetBroadcastStats (для каналов 500+)       │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ MTProto (encrypted)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Telegram DC Servers                       │
└─────────────────────────────────────────────────────────────┘
```

## Данные из MTProto API

| Метод | Данные |
|-------|--------|
| `channels.GetFullChannel` | subscribers_count, about, linked_chat, stats_dc |
| `stats.GetBroadcastStats` | languages_graph, growth_graph, top_hours_graph, enabled_notifications |

**Важно:** Статистика `GetBroadcastStats` доступна только для каналов с **500+ подписчиков**.

## Реализация

### 1. Добавить секреты в Lovable Cloud

| Секрет | Значение |
|--------|----------|
| `MTPROTO_API_ID` | `32035706` |
| `MTPROTO_API_HASH` | `6036cd3cb12e15ff119e92cb62f4c3b5` |
| `MTPROTO_SESSION` | Строка сессии (которую ты предоставил) |

### 2. Создать Edge Function `mtproto-channel-stats`

Файл: `supabase/functions/mtproto-channel-stats/index.ts`

```typescript
import { TelegramClient, Api } from "https://deno.land/x/grm@0.6.0/mod.ts";
import { StringSession } from "https://deno.land/x/grm@0.6.0/sessions/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Парсинг графика языков
function parseLanguagesGraph(graph: any): { language: string; percentage: number }[] {
  if (!graph?.json?.data) return [];
  // Структура: { columns: [[name, ...values]], names: {id: label} }
  // ...логика парсинга
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { username } = await req.json();
  
  const apiId = parseInt(Deno.env.get("MTPROTO_API_ID")!);
  const apiHash = Deno.env.get("MTPROTO_API_HASH")!;
  const sessionString = Deno.env.get("MTPROTO_SESSION")!;

  const client = new TelegramClient(
    new StringSession(sessionString),
    apiId,
    apiHash
  );

  await client.connect();

  // 1. GetFullChannel - базовая информация
  const fullChannel = await client.invoke(
    new Api.channels.GetFullChannel({ channel: username })
  );

  // 2. GetBroadcastStats - расширенная статистика (500+ подписчиков)
  let broadcastStats = null;
  try {
    broadcastStats = await client.invoke(
      new Api.stats.GetBroadcastStats({ channel: username, dark: false })
    );
  } catch (e) {
    console.log("Stats not available (need 500+ subscribers):", e.message);
  }

  await client.disconnect();

  return new Response(JSON.stringify({
    success: true,
    fullChannel: {
      participantsCount: fullChannel.fullChat.participantsCount,
      about: fullChannel.fullChat.about,
      statsDc: fullChannel.fullChat.statsDc,
    },
    stats: broadcastStats ? {
      languageStats: parseLanguagesGraph(broadcastStats.languagesGraph),
      growthRate: broadcastStats.followers?.current || 0,
      enabledNotifications: broadcastStats.enabledNotifications?.part || 0,
      topHours: parseTopHoursGraph(broadcastStats.topHoursGraph),
    } : null,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
```

### 3. Добавить конфигурацию

Файл: `supabase/functions/mtproto-channel-stats/deno.json`

```json
{
  "imports": {
    "grm": "https://deno.land/x/grm@0.6.0/mod.ts",
    "grm/sessions": "https://deno.land/x/grm@0.6.0/sessions/mod.ts"
  }
}
```

### 4. Обновить `refresh-channel-stats`

Добавить вызов MTProto функции после обновления базовых данных:

```typescript
// После получения базовой статистики через Bot API
// Вызвать MTProto для расширенных данных
if (channel.username && subscribersCount >= 500) {
  try {
    const mtprotoResponse = await fetch(
      `${supabaseUrl}/functions/v1/mtproto-channel-stats`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: channel.username }),
      }
    );
    const mtprotoData = await mtprotoResponse.json();
    
    if (mtprotoData.success && mtprotoData.stats) {
      languageStats = mtprotoData.stats.languageStats;
      premiumPercentage = mtprotoData.stats.premiumPercentage;
      growthRate = mtprotoData.stats.growthRate;
      topHours = mtprotoData.stats.topHours;
    }
  } catch (e) {
    console.log("[refresh] MTProto stats failed:", e);
  }
}
```

### 5. Обновить `supabase/config.toml`

```toml
[functions.mtproto-channel-stats]
verify_jwt = false
```

## Особенности GRM в Edge Functions

| Аспект | Детали |
|--------|--------|
| **Cold Start** | 2-4 секунды (загрузка модулей MTProto) |
| **Таймаут** | По умолчанию 60 сек, достаточно для подключения |
| **Сессия** | StringSession не требует файловой системы |
| **DC Миграция** | GRM автоматически обрабатывает STATS_MIGRATE |

## Ограничения и решения

| Проблема | Решение |
|----------|---------|
| Статистика недоступна (<500 подписчиков) | Fallback на текущий скрапинг t.me |
| Rate limits Telegram | Кэширование 24 часа, как сейчас |
| Session expiration | Мониторинг ошибок, переавторизация при необходимости |

## Файлы к созданию/изменению

| Файл | Действие |
|------|----------|
| `supabase/functions/mtproto-channel-stats/index.ts` | Создать — MTProto клиент |
| `supabase/functions/mtproto-channel-stats/deno.json` | Создать — зависимости |
| `supabase/functions/refresh-channel-stats/index.ts` | Обновить — вызов MTProto |
| `supabase/config.toml` | Обновить — добавить функцию |

## Результат

После реализации в `ChannelAnalytics` будут отображаться **реальные данные**:
- Языки аудитории (из `languages_graph`)
- % Premium пользователей (если доступно в API)
- Прирост подписчиков (`growth_rate`)  
- Пиковые часы активности (`top_hours`)

Плашки "Примерно" исчезнут для каналов с реальными данными.
