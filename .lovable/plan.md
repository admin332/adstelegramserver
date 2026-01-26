

## Цель
Реализовать автоматическое отслеживание оплаты эскроу-адресов через TON API и отправку уведомлений владельцу канала при подтверждении оплаты.

## Архитектура решения

```text
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Рекламодатель  │────▶│  Эскроу-адрес    │────▶│   TON API       │
│  оплачивает     │     │  (EQ...)         │     │  (TonCenter)    │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │  Edge Function   │◀────│   Cron Job      │
                        │  check-escrow    │     │   (каждую мин)  │
                        └────────┬─────────┘     └─────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
           ┌───────────────┐         ┌───────────────┐
           │ Обновить      │         │ Отправить     │
           │ статус сделки │         │ уведомления   │
           │ pending→escrow│         │ в Telegram    │
           └───────────────┘         └───────────────┘
```

## Изменения

### 1. Создать Edge Function `check-escrow-payments`

**Файл**: `supabase/functions/check-escrow-payments/index.ts`

Эта функция:
- Получает все сделки со статусом `pending`
- Для каждого эскроу-адреса проверяет баланс через TonCenter API
- Если баланс >= total_price, обновляет статус на `escrow`
- Отправляет владельцу канала два сообщения:
  1. Превью рекламного поста (медиа + текст + кнопка)
  2. Уведомление с кнопками "Одобрить" / "Отклонить"

```typescript
// Структура функции
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 1. Получить pending deals
const { data: pendingDeals } = await supabase
  .from('deals')
  .select(`
    id, escrow_address, total_price, posts_count, duration_hours, scheduled_at,
    campaign:campaigns(text, media_urls, button_text, button_url),
    channel:channels(
      id, title, telegram_chat_id, owner_id,
      owner:users!channels_owner_id_fkey(telegram_id)
    )
  `)
  .eq('status', 'pending')
  .not('escrow_address', 'is', null);

// 2. Для каждой сделки проверить баланс
for (const deal of pendingDeals) {
  const balance = await checkEscrowBalance(deal.escrow_address);
  const requiredNano = deal.total_price * 1_000_000_000;
  
  if (balance >= requiredNano) {
    // 3. Обновить статус
    await supabase.from('deals').update({
      status: 'escrow',
      escrow_balance: balance / 1_000_000_000,
      payment_verified_at: new Date().toISOString()
    }).eq('id', deal.id);
    
    // 4. Отправить уведомления владельцу
    await sendPaymentNotification(deal);
  }
}
```

### 2. Функция проверки баланса через TonCenter API

TonCenter предоставляет бесплатный API (с лимитами) для проверки баланса:

```typescript
async function checkEscrowBalance(address: string): Promise<number> {
  const apiKey = Deno.env.get("TONCENTER_API_KEY"); // Опционально
  const baseUrl = "https://toncenter.com/api/v2";
  
  const url = apiKey 
    ? `${baseUrl}/getAddressBalance?address=${address}&api_key=${apiKey}`
    : `${baseUrl}/getAddressBalance?address=${address}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.ok && data.result) {
    return parseInt(data.result, 10); // Баланс в nanoTON
  }
  
  return 0;
}
```

### 3. Функция отправки уведомлений владельцу канала

Два сообщения:
1. **Превью рекламы** — медиа + текст + кнопка (как реальный пост)
2. **Уведомление с кнопками** — информация о сделке + inline-кнопки

```typescript
async function sendPaymentNotification(deal: Deal) {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const ownerTelegramId = deal.channel.owner.telegram_id;
  const campaign = deal.campaign;
  
  // Сообщение 1: Превью рекламы (используем логику из send-campaign-preview)
  if (campaign.media_urls?.length > 0) {
    // sendPhoto/sendVideo/sendMediaGroup
  } else {
    await sendMessage(ownerTelegramId, campaign.text, {
      button_text: campaign.button_text,
      button_url: campaign.button_url
    });
  }
  
  // Сообщение 2: Уведомление с кнопками
  const formattedDate = formatDate(deal.scheduled_at);
  const postsWord = getPostsWord(deal.posts_count); // 1 пост, 2 поста, 5 постов
  
  const notificationText = `
✅ <b>Реклама оплачена!</b>

Рекламодатель оплатил <b>${deal.posts_count} ${postsWord}</b> на <b>${deal.duration_hours} часов</b>

📅 Начало: <b>${formattedDate}</b>

💰 Вы получите: <b>${deal.total_price} TON</b>

Проверьте материалы выше и нажмите «Одобрить» для публикации или откройте бот и предложите изменения.
`;

  await sendMessage(ownerTelegramId, notificationText, {
    inline_keyboard: [
      [
        { text: "✅ Одобрить", callback_data: `approve_deal:${deal.id}` },
        { text: "❌ Отклонить", callback_data: `reject_deal:${deal.id}` }
      ]
    ]
  });
}
```

### 4. Добавить Cron Job для периодической проверки

Создать SQL-запрос для запуска функции каждую минуту:

```sql
-- Включить расширения
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Создать cron job
SELECT cron.schedule(
  'check-escrow-payments',
  '* * * * *', -- каждую минуту
  $$
  SELECT net.http_post(
    url := 'https://fdxyittddmpyhaiijddp.supabase.co/functions/v1/check-escrow-payments',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer [ANON_KEY]"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

### 5. Обновить supabase/config.toml

```toml
[functions.check-escrow-payments]
verify_jwt = false
```

### 6. (Опционально) Добавить Edge Function для обработки callback-кнопок

**Файл**: `supabase/functions/telegram-webhook/index.ts`

Обрабатывает нажатия на кнопки "Одобрить" / "Отклонить":

```typescript
// При нажатии approve_deal:xxx
if (callbackData.startsWith('approve_deal:')) {
  const dealId = callbackData.split(':')[1];
  
  // Обновить статус сделки
  await supabase.from('deals').update({
    status: 'in_progress',
    posted_at: new Date().toISOString()
  }).eq('id', dealId);
  
  // Опубликовать пост в канал (автоматическая публикация)
  await publishAdToChannel(dealId);
  
  // Уведомить рекламодателя
  await notifyAdvertiser(dealId, 'approved');
}
```

## Файлы для создания/изменения

| Файл | Действие |
|------|----------|
| `supabase/functions/check-escrow-payments/index.ts` | Создать |
| `supabase/config.toml` | Обновить (добавить функцию) |
| SQL: Cron Job | Выполнить через insert tool |

## Секреты

Опционально для повышения лимитов:
- `TONCENTER_API_KEY` — API ключ от TonCenter (бесплатно, но с лимитами без ключа)

Без ключа TonCenter позволяет делать ~1 запрос в секунду.

## Текст уведомления

```text
Сообщение 1: [Медиа + текст рекламы + кнопка-ссылка]

Сообщение 2:
✅ Реклама оплачена!

Рекламодатель оплатил 2 поста на 24 часа

📅 Начало: 26.01.2026 в 22:00

💰 Вы получите: 2 TON

Проверьте материалы выше и нажмите «Одобрить» для публикации или откройте бот и предложите изменения.

[✅ Одобрить]  [❌ Отклонить]
```

## Склонение слова "пост"

```typescript
function getPostsWord(count: number): string {
  const lastTwo = count % 100;
  const lastOne = count % 10;
  
  if (lastTwo >= 11 && lastTwo <= 19) return "постов";
  if (lastOne === 1) return "пост";
  if (lastOne >= 2 && lastOne <= 4) return "поста";
  return "постов";
}
```

## Результат

1. Каждую минуту система проверяет все pending-сделки
2. При обнаружении оплаты:
   - Статус сделки меняется на `escrow`
   - Сохраняется баланс и время подтверждения
   - Владельцу канала приходит превью рекламы
   - Владельцу канала приходит уведомление с кнопками
3. Владелец может одобрить или отклонить рекламу

