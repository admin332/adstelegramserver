# MTProto в Edge Functions — Технические ограничения

## Проблема

Библиотеки MTProto (mtcute, gramjs, grm) требуют:
- **node:sqlite** — для хранения сессий и ключей
- **node:crypto** — для криптографии MTProto
- **TCP сокеты** — для постоянного соединения с DC

Deno Edge Functions не поддерживают эти модули.

## Решение: VPS Микросервис

Простой Node.js сервис для получения статистики:

```text
┌─────────────────────────────────────────────────────────────┐
│                      Adsingo Frontend                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           mtproto-channel-stats (Edge Function)             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Proxy to VPS if MTPROTO_VPS_URL configured         │   │
│  │  Otherwise returns setupRequired: true               │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              VPS Microservice (Railway/Render)              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Node.js + GramJS                                   │   │
│  │  - StringSession authentication                      │   │
│  │  - stats.GetBroadcastStats                          │   │
│  │  - channels.GetFullChannel                          │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ MTProto
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Telegram DC Servers                       │
└─────────────────────────────────────────────────────────────┘
```

## Быстрый деплой на Railway

### 1. Создать проект

```bash
mkdir mtproto-service && cd mtproto-service
npm init -y
npm install telegram gramjs express
```

### 2. Создать index.js

```javascript
const express = require('express');
const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');

const app = express();
const API_KEY = process.env.MTPROTO_VPS_SECRET;
const client = new TelegramClient(
  new StringSession(process.env.MTPROTO_SESSION),
  parseInt(process.env.MTPROTO_API_ID),
  process.env.MTPROTO_API_HASH,
  { connectionRetries: 5 }
);

// Auth middleware
app.use((req, res, next) => {
  if (req.headers['x-api-key'] !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Get channel stats
app.get('/stats/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    const entity = await client.getEntity(username);
    const fullChannel = await client.invoke(
      new Api.channels.GetFullChannel({ channel: entity })
    );
    
    let stats = null;
    try {
      stats = await client.invoke(
        new Api.stats.GetBroadcastStats({ channel: entity, dark: false })
      );
    } catch (e) {
      console.log('Stats not available:', e.message);
    }
    
    res.json({
      success: true,
      channel: {
        participantsCount: fullChannel.fullChat.participantsCount,
        about: fullChannel.fullChat.about,
        statsDc: fullChannel.fullChat.statsDc,
      },
      stats: stats ? parseStats(stats) : null,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

function parseStats(stats) {
  return {
    languageStats: parseGraph(stats.languagesGraph),
    topHours: parseGraph(stats.topHoursGraph),
    growthRate: stats.followers?.current 
      ? ((stats.followers.current - stats.followers.previous) / stats.followers.previous * 100).toFixed(1)
      : null,
    notificationsEnabled: stats.enabledNotifications?.part 
      ? (stats.enabledNotifications.part * 100).toFixed(1) 
      : null,
  };
}

function parseGraph(graph) {
  if (!graph?.json?.data) return [];
  try {
    const data = JSON.parse(graph.json.data);
    // Parse chart data...
    return data.columns?.slice(1).map(col => ({
      label: data.names?.[col[0]] || col[0],
      value: col.slice(1).reduce((a, b) => a + b, 0),
    })) || [];
  } catch { return []; }
}

// Start server
const PORT = process.env.PORT || 3000;
client.connect().then(() => {
  console.log('Connected to Telegram');
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
```

### 3. Переменные окружения на Railway

| Переменная | Значение |
|------------|----------|
| `MTPROTO_API_ID` | 32035706 |
| `MTPROTO_API_HASH` | 6036cd3cb12e15ff119e92cb62f4c3b5 |
| `MTPROTO_SESSION` | [Строка сессии из Lovable secrets] |
| `MTPROTO_VPS_SECRET` | [Сгенерированный API ключ] |

### 4. Добавить секреты в Lovable

После деплоя добавьте в Lovable Cloud:

| Секрет | Значение |
|--------|----------|
| `MTPROTO_VPS_URL` | https://your-app.railway.app |
| `MTPROTO_VPS_SECRET` | [Тот же ключ что на Railway] |

## Альтернатива: Render.com

1. Создать Web Service
2. Подключить GitHub репозиторий с кодом выше
3. Добавить переменные окружения
4. Получить URL: https://your-service.onrender.com

## После настройки

Edge Function `mtproto-channel-stats` автоматически начнёт проксировать запросы на VPS и возвращать реальные данные:
- Языки аудитории
- Прирост подписчиков  
- % включенных уведомлений
- Активность по часам

`refresh-channel-stats` уже настроен на вызов MTProto функции для каналов 500+.
