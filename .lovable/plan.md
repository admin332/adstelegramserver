
# Интеграция MTProto для детальной статистики каналов

## Статус: Требуется VPS

Supabase Edge Functions **не поддерживают** библиотеки типа `grm` (MTProto) из-за ограничений на импорт внешних модулей с сетевыми зависимостями (`--allow-import` флаг недоступен).

## Текущая реализация

```text
┌─────────────────────────────────────────────────────────────┐
│                      Adsingo Frontend                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│            refresh-channel-stats (Edge Function)            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  1. Базовая статистика через Bot API + скрапинг    │   │
│  │  2. Попытка вызвать MTProto VPS (если настроен)    │   │
│  │  3. Обновление БД со всеми данными                  │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           mtproto-channel-stats (Edge Function)             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Прокси к VPS (если MTPROTO_VPS_URL настроен)       │   │
│  │  Иначе возвращает setupRequired: true               │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           MTProto VPS (ТРЕБУЕТСЯ НАСТРОЙКА)                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Node.js + GramJS                                    │   │
│  │  - StringSession авторизация                        │   │
│  │  - channels.GetFullChannel                          │   │
│  │  - stats.GetBroadcastStats                          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Следующие шаги для полной интеграции

### 1. Купить VPS

| Провайдер | План | Цена | Рекомендация |
|-----------|------|------|--------------|
| **Hetzner** | CX11 | ~€4/мес | ✅ Лучший выбор |
| **Contabo** | VPS S | ~€5/мес | Больше ресурсов |
| **DigitalOcean** | Basic | $6/мес | Простота |

### 2. Развернуть MTProto сервис на VPS

```bash
# SSH на VPS
ssh root@your-vps-ip

# Установить Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Создать проект
mkdir mtproto-stats && cd mtproto-stats
npm init -y
npm install telegram gramjs express dotenv
```

### 3. Создать сервис (server.js)

```javascript
const express = require("express");
const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");

const app = express();

const apiId = parseInt(process.env.TG_API_ID);
const apiHash = process.env.TG_API_HASH;
const sessionString = process.env.TG_SESSION;
const apiSecret = process.env.API_SECRET;

let client;

async function initClient() {
  client = new TelegramClient(
    new StringSession(sessionString),
    apiId,
    apiHash,
    { connectionRetries: 5 }
  );
  await client.connect();
  console.log("MTProto connected");
}

// Проверка API ключа
app.use((req, res, next) => {
  const key = req.headers["x-api-key"];
  if (key !== apiSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

// Получить статистику канала
app.get("/stats/:username", async (req, res) => {
  try {
    const { username } = req.params;
    
    const result = await client.invoke(
      new Api.channels.GetFullChannel({ channel: username })
    );
    
    const fullChat = result.fullChat;
    
    let stats = null;
    if (fullChat.participantsCount >= 500 && fullChat.canViewStats) {
      try {
        stats = await client.invoke(
          new Api.stats.GetBroadcastStats({ channel: username, dark: false })
        );
      } catch (e) {
        console.log("Stats not available:", e.message);
      }
    }
    
    res.json({
      success: true,
      channel: {
        title: result.chats[0]?.title,
        participantsCount: fullChat.participantsCount,
        about: fullChat.about,
        canViewStats: fullChat.canViewStats,
      },
      stats: stats ? {
        followers: stats.followers,
        viewsPerPost: stats.viewsPerPost,
        enabledNotifications: stats.enabledNotifications,
        languagesGraph: stats.languagesGraph,
        topHoursGraph: stats.topHoursGraph,
      } : null,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(3000, () => {
  console.log("API running on port 3000");
  initClient();
});
```

### 4. Настроить HTTPS (Caddy рекомендуется)

```bash
sudo apt install caddy

# /etc/caddy/Caddyfile
mtproto.yourdomain.com {
    reverse_proxy localhost:3000
}

sudo systemctl restart caddy
```

### 5. Добавить секреты в Lovable Cloud

| Секрет | Описание |
|--------|----------|
| `MTPROTO_VPS_URL` | `https://mtproto.yourdomain.com` |
| `MTPROTO_VPS_SECRET` | Случайный ключ 32+ символа |

После добавления секретов, Edge Function `mtproto-channel-stats` автоматически начнёт проксировать запросы к VPS.

## Уже настроенные секреты

- ✅ `MTPROTO_API_ID` - 32035706
- ✅ `MTPROTO_API_HASH` - настроен
- ✅ `MTPROTO_SESSION` - настроен (для VPS)

## Поля БД для MTProto данных

Таблица `channels` уже содержит нужные поля:
- `language_stats` - jsonb
- `growth_rate` - numeric
- `notifications_enabled` - numeric
- `top_hours` - jsonb

## Результат после настройки VPS

ChannelAnalytics будет отображать **реальные данные**:
- ✅ Языки аудитории (из languages_graph)
- ✅ Прирост подписчиков (growth_rate)
- ✅ % включённых уведомлений
- ✅ Пиковые часы активности
