
# План: Система отзывов после завершения рекламы

## Обзор

Реализация системы сбора отзывов через Telegram после успешного завершения рекламной сделки:
1. Отправка сообщений с кнопками оценки (1-5) обоим участникам
2. Обработка нажатий кнопок через Telegram Webhook
3. Сохранение отзывов в базу данных
4. Отображение отзывов на странице канала
5. Увеличение счётчика успешных реклам

## Архитектура решения

```text
┌─────────────────────┐
│ complete-posted-deals│
│  (после завершения) │
├─────────────────────┤
│ 1. Отправить TON    │
│ 2. Отправить сообще-│
│    ния с кнопками   │
│    оценки (1-5)     │
│ 3. successful_ads +1│
└─────────────────────┘
           │
           ▼
┌─────────────────────┐
│ telegram-webhook    │
│  (новая функция)    │
├─────────────────────┤
│ • Обработка callback│
│   rate_channel:id:5 │
│   rate_advertiser:  │
│   id:4              │
│ • Сохранение в      │
│   reviews таблицу   │
│ • answerCallback-   │
│   Query             │
└─────────────────────┘
```

## Шаги реализации

### 1. Модифицировать complete-posted-deals

**Файл:** `supabase/functions/complete-posted-deals/index.ts`

После успешного завершения сделки:

1. **Увеличить `successful_ads` канала на +1:**
```typescript
await supabase
  .from("channels")
  .update({ 
    successful_ads: supabase.rpc('increment', { x: 1 }) 
  })
  .eq("id", deal.channel.id);
```
Или через прямой SQL update.

2. **Отправить сообщение рекламодателю с кнопками оценки канала:**
```typescript
await sendTelegramRequest("sendMessage", {
  chat_id: advertiser.telegram_id,
  text: "⭐ Оцените работу канала...",
  reply_markup: {
    inline_keyboard: [[
      { text: "1", callback_data: `rate_channel:${deal.id}:1` },
      { text: "2", callback_data: `rate_channel:${deal.id}:2` },
      { text: "3", callback_data: `rate_channel:${deal.id}:3` },
      { text: "4", callback_data: `rate_channel:${deal.id}:4` },
      { text: "5", callback_data: `rate_channel:${deal.id}:5` },
    ]]
  }
});
```

3. **Отправить сообщение владельцу канала с кнопками оценки рекламодателя:**
```typescript
// Аналогично с callback_data: `rate_advertiser:${deal.id}:N`
```

### 2. Создать telegram-webhook Edge Function

**Новый файл:** `supabase/functions/telegram-webhook/index.ts`

Обрабатывает webhook события от Telegram Bot API:

```typescript
// Основная логика:
Deno.serve(async (req) => {
  const body = await req.json();
  
  // Обработка callback_query (нажатие inline кнопки)
  if (body.callback_query) {
    const { id, data, from } = body.callback_query;
    
    // Парсинг: rate_channel:deal_id:rating или rate_advertiser:deal_id:rating
    const [action, dealId, rating] = data.split(':');
    
    if (action === 'rate_channel') {
      // Найти deal, проверить что from.id === advertiser.telegram_id
      // Вставить отзыв в reviews
      // answerCallbackQuery с подтверждением
    }
    
    if (action === 'rate_advertiser') {
      // Найти deal, проверить что from.id === owner.telegram_id  
      // Пока не сохраняем (нет таблицы для рейтинга рекламодателей)
      // Или сохранять в отдельную таблицу advertiser_reviews
    }
  }
  
  return new Response(JSON.stringify({ ok: true }));
});
```

### 3. Зарегистрировать Webhook в Telegram

Нужно выполнить один раз вызов `setWebhook` для бота:
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=<SUPABASE_URL>/functions/v1/telegram-webhook
```

Это можно сделать через curl или добавить в админ-панель.

### 4. Создать компонент ChannelReviews

**Новый файл:** `src/components/channel/ChannelReviews.tsx`

Отображение списка отзывов на странице канала:
- Аватар и имя рекламодателя
- Звёзды рейтинга (1-5)
- Дата отзыва
- Опционально: комментарий (если добавим позже)

### 5. Интегрировать в Channel.tsx

**Файл:** `src/pages/Channel.tsx`

Добавить секцию отзывов:
```tsx
import ChannelReviews from '@/components/channel/ChannelReviews';
import { useChannelReviews } from '@/hooks/useChannelReviews';

// В компоненте:
const { data: reviews } = useChannelReviews(id);

// В JSX после Verified Analytics:
<ChannelReviews reviews={reviews || []} />
```

### 6. Обновить config.toml

**Файл:** `supabase/config.toml`

```toml
[functions.telegram-webhook]
verify_jwt = false
```

## Изменяемые файлы

| Файл | Действие |
|------|----------|
| `supabase/functions/complete-posted-deals/index.ts` | Добавить отправку сообщений с кнопками оценки и увеличение successful_ads |
| `supabase/functions/telegram-webhook/index.ts` | **Создать** - обработка Telegram callbacks |
| `src/components/channel/ChannelReviews.tsx` | **Создать** - UI компонент списка отзывов |
| `src/pages/Channel.tsx` | Добавить секцию отзывов |
| `supabase/config.toml` | Добавить конфиг для telegram-webhook |

## Формат callback_data

- `rate_channel:dealId:rating` - Рекламодатель оценивает канал
- `rate_advertiser:dealId:rating` - Владелец канала оценивает рекламодателя

## Безопасность

1. **Проверка отправителя** - Telegram webhook приходит с user_id, проверяем что это действительно участник сделки
2. **Однократная оценка** - Проверяем что отзыв для этой сделки ещё не существует
3. **Валидация рейтинга** - rating должен быть от 1 до 5

## Влияние на систему

| Параметр | Изменение |
|----------|-----------|
| После completed deal | Отправляются 2 сообщения с кнопками |
| При нажатии кнопки | Отзыв сохраняется, кнопки исчезают |
| Страница /channel/:id | Показывает список отзывов |
| successful_ads | Автоматически +1 при завершении |

## Ограничения

- Рейтинг рекламодателей пока не сохраняется (нет таблицы) - можно добавить позже
- Комментарии к отзывам не предусмотрены в MVP
