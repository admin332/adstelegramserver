

## План: Отправка превью кампании через Telegram бота после создания

### Что будет сделано

После нажатия кнопки "Создать кампанию" пользователю в Telegram придёт сообщение от бота с превью его рекламы — точно так, как она будет выглядеть в канале.

### Архитектура решения

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         Создание кампании                           │
├─────────────────────────────────────────────────────────────────────┤
│  1. Пользователь заполняет форму и нажимает "Создать"               │
│                              ↓                                       │
│  2. Edge Function create-campaign создаёт кампанию в БД             │
│                              ↓                                       │
│  3. Edge Function send-campaign-preview отправляет превью в Telegram │
│                              ↓                                       │
│  4. Пользователь получает сообщение от бота с рекламой              │
└─────────────────────────────────────────────────────────────────────┘
```

### Файлы для создания/изменения

| Файл | Действие | Описание |
|------|----------|----------|
| `supabase/functions/send-campaign-preview/index.ts` | Создать | Новая Edge Function для отправки превью через Telegram Bot API |
| `src/components/create/CreateCampaignForm.tsx` | Изменить | Добавить вызов send-campaign-preview после успешного создания |

---

### Техническая реализация

**1. Edge Function `send-campaign-preview`**

Новая функция будет:
- Принимать `telegram_id`, `text`, `media_urls`, `button_text`, `button_url`
- Использовать Telegram Bot API для отправки сообщения
- Поддерживать медиагруппы (до 10 фото/видео) через `sendMediaGroup`
- Добавлять inline-кнопку под сообщением

```typescript
interface SendPreviewRequest {
  telegram_id: number;      // ID пользователя в Telegram
  text: string;             // Текст рекламы
  media_urls?: string[];    // Массив URL медиафайлов
  button_text?: string;     // Текст кнопки
  button_url?: string;      // URL кнопки
}
```

**Логика отправки:**

```text
Если media_urls пуст:
  → sendMessage с текстом и кнопкой

Если media_urls содержит 1 файл:
  → Определить тип (фото/видео)
  → sendPhoto или sendVideo с caption и кнопкой

Если media_urls содержит 2-10 файлов:
  → sendMediaGroup для группы медиа (caption у первого)
  → Затем отдельным сообщением отправить кнопку (reply_markup)
```

**Telegram Bot API методы:**

```typescript
// Отправка текста
POST https://api.telegram.org/bot{TOKEN}/sendMessage
{
  chat_id: telegram_id,
  text: text,
  parse_mode: "HTML",
  reply_markup: {
    inline_keyboard: [[{ text: button_text, url: button_url }]]
  }
}

// Отправка фото
POST https://api.telegram.org/bot{TOKEN}/sendPhoto
{
  chat_id: telegram_id,
  photo: media_url,
  caption: text,
  parse_mode: "HTML",
  reply_markup: { ... }
}

// Отправка медиагруппы
POST https://api.telegram.org/bot{TOKEN}/sendMediaGroup
{
  chat_id: telegram_id,
  media: [
    { type: "photo", media: url1, caption: text },
    { type: "photo", media: url2 },
    ...
  ]
}
```

---

**2. Изменение CreateCampaignForm.tsx**

После успешного создания кампании добавить вызов превью:

```typescript
// После успешного создания кампании
const result = await response.json();

if (response.ok && result.success) {
  // Отправить превью в Telegram
  if (user.telegram_id) {
    await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-campaign-preview`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          telegram_id: user.telegram_id,
          text: campaignData.text,
          media_urls: mediaUrls,
          button_text: campaignData.button_text || undefined,
          button_url: campaignData.button_url || undefined,
        }),
      }
    );
  }
  
  toast({
    title: "Кампания создана!",
    description: "Превью отправлено вам в Telegram",
  });
}
```

---

### Результат

1. Пользователь создаёт кампанию
2. Бот Adsingo отправляет ему личное сообщение с превью
3. Превью выглядит точно как будущий рекламный пост:
   - Медиа (если есть)
   - Текст рекламы
   - Кнопка (если добавлена)
4. Пользователь сразу видит, как будет выглядеть его реклама

### Пример сообщения от бота

```text
┌─────────────────────────────────┐
│  🖼️ [Изображение/видео]         │
├─────────────────────────────────┤
│  📝 Превью вашей рекламы:       │
│                                 │
│  Текст рекламного поста...      │
│                                 │
│  [🔗 Кнопка действия]           │
└─────────────────────────────────┘
```

