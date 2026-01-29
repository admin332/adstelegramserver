

# MTProto в Deno Edge Function с использованием mtcute

## Обзор

Реализую получение статистики каналов через MTProto **напрямую в Edge Function** используя библиотеку `mtcute` — современный TypeScript клиент для Telegram, который поддерживает Deno.

## Почему mtcute вместо grm?

| Аспект | grm | mtcute |
|--------|-----|--------|
| Поддержка | Заброшен (v0.1.4) | Активная разработка (v0.27+) |
| JSR | Нет | Да (`jsr:@mtcute/deno`) |
| Deno совместимость | Частичная | Полная |
| Конвертация сессий | Нет | Есть `@mtcute/convert` |
| MemoryStorage | Нужен workaround | Встроенный |

## Архитектура

```text
┌─────────────────────────────────────────────────────────────┐
│                      Adsingo Frontend                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           mtproto-channel-stats (Edge Function)             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  mtcute TelegramClient                               │   │
│  │  - MemoryStorage (без файловой системы)              │   │
│  │  - importSession() из GramJS формата                 │   │
│  │  - tg.call({ _: 'channels.getFullChannel' })        │   │
│  │  - tg.call({ _: 'stats.getBroadcastStats' })        │   │
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
| `channels.getFullChannel` | subscribers_count, about, linked_chat, stats_dc |
| `stats.getBroadcastStats` | languages_graph, growth_graph, top_hours_graph, enabled_notifications, views_per_post |

## Реализация

### 1. Обновить `supabase/functions/mtproto-channel-stats/deno.json`

```json
{
  "imports": {
    "@mtcute/deno": "jsr:@mtcute/deno@^0.27.0",
    "@mtcute/convert": "jsr:@mtcute/convert@^0.27.0",
    "@mtcute/core": "jsr:@mtcute/core@^0.27.0"
  }
}
```

### 2. Полностью переписать `supabase/functions/mtproto-channel-stats/index.ts`

Основные изменения:
- Импорт `TelegramClient` из `@mtcute/deno`
- Импорт `convertFromGramjsSession` для конвертации текущей сессии
- Использование `MemoryStorage` для serverless окружения
- Импорт сессии через `tg.importSession()`
- Вызов `tg.call({ _: 'channels.getFullChannel', channel: username })`
- Вызов `tg.call({ _: 'stats.getBroadcastStats', channel: ..., dark: false })`
- Обработка ошибки `STATS_MIGRATE` для переключения DC
- Парсинг графиков (languages, top_hours, growth)

```typescript
// Пример структуры кода
import { TelegramClient, MemoryStorage } from "jsr:@mtcute/deno@^0.27.0";
import { convertFromGramjsSession } from "jsr:@mtcute/convert@^0.27.0";

const tg = new TelegramClient({
  apiId: parseInt(Deno.env.get("MTPROTO_API_ID")!),
  apiHash: Deno.env.get("MTPROTO_API_HASH")!,
  storage: new MemoryStorage(),
});

// Конвертируем и импортируем GramJS сессию
const gramjsSession = Deno.env.get("MTPROTO_SESSION")!;
await tg.importSession(convertFromGramjsSession(gramjsSession));

// Получаем полную информацию о канале
const fullChannel = await tg.call({
  _: "channels.getFullChannel",
  channel: { _: "inputChannel", channelId: ..., accessHash: ... },
});

// Получаем статистику (для каналов 500+)
const stats = await tg.call({
  _: "stats.getBroadcastStats",
  channel: ...,
  dark: false,
});
```

### 3. Обработка STATS_MIGRATE

Telegram может вернуть ошибку `STATS_MIGRATE_X`, требующую подключения к другому DC. mtcute автоматически обрабатывает миграцию DC.

### 4. Парсинг графиков

Создам функции для парсинга:
- `parseLanguagesGraph()` — языки аудитории
- `parseTopHoursGraph()` — активность по часам
- `parseFollowersGraph()` — прирост подписчиков

## Ограничения и решения

| Проблема | Решение |
|----------|---------|
| Cold start (загрузка mtcute) | 3-5 секунд первый запрос |
| Edge Function timeout | 60 сек достаточно |
| Статистика недоступна (<500 подписчиков) | Возвращаем null, используем fallback |
| Session expiration | Обработка ошибок, переавторизация |

## Файлы к изменению

| Файл | Действие |
|------|----------|
| `supabase/functions/mtproto-channel-stats/deno.json` | Обновить — mtcute зависимости |
| `supabase/functions/mtproto-channel-stats/index.ts` | Переписать — mtcute клиент |

## Секреты

Уже добавлены:
- `MTPROTO_API_ID` — 32035706
- `MTPROTO_API_HASH` — 6036cd3cb12e15ff119e92cb62f4c3b5  
- `MTPROTO_SESSION` — GramJS StringSession

## Результат

После реализации Edge Function будет:
1. Подключаться к Telegram через MTProto
2. Резолвить канал по username
3. Получать полную информацию (`channels.getFullChannel`)
4. Получать статистику (`stats.getBroadcastStats`) для каналов 500+
5. Возвращать парсенные данные: языки, top hours, growth rate, notifications enabled

`ChannelAnalytics` будет отображать **реальные данные** вместо "Примерно".

