

# Переход на хранение file_id + entities для prompt-черновиков

## Проблема

Сейчас при получении черновика от автора:
1. Система получает `file_id` медиа
2. Конвертирует в временный URL через `getFile` API
3. Сохраняет URL в базу
4. Через час URL истекает → публикация падает с ошибкой

Также теряется форматирование текста (bold, italic, premium emoji) потому что сохраняется только `text`, но не `entities`.

## Решение

Хранить нативные данные Telegram:
- **Текст**: `text` + `entities` (для сохранения форматирования и premium emoji)
- **Медиа**: `file_id` + `type` (бессрочное хранение в Telegram)

## Изменения в БД

Добавить новые колонки в таблицу `deals`:

```sql
ALTER TABLE deals ADD COLUMN author_draft_entities JSONB DEFAULT '[]';
ALTER TABLE deals ADD COLUMN author_draft_media JSONB DEFAULT '[]';
```

Структура `author_draft_media`:
```json
[
  { "type": "photo", "file_id": "AgACAgIAAxkBAA..." },
  { "type": "video", "file_id": "BAACAgIAAxkBAA..." }
]
```

## Изменения в telegram-webhook/index.ts

### 1. Новая функция извлечения медиа (вместо extractMediaUrls)

```typescript
interface MediaItem {
  type: 'photo' | 'video' | 'document';
  file_id: string;
}

function extractMedia(message: Record<string, unknown>): MediaItem[] {
  const media: MediaItem[] = [];
  
  if (message.photo && Array.isArray(message.photo)) {
    const largestPhoto = message.photo[message.photo.length - 1];
    media.push({ type: 'photo', file_id: largestPhoto.file_id });
  }
  
  if (message.video) {
    media.push({ type: 'video', file_id: message.video.file_id });
  }
  
  if (message.document) {
    const doc = message.document as { file_id: string; mime_type?: string };
    if (doc.mime_type?.startsWith('image/') || doc.mime_type?.startsWith('video/')) {
      const type = doc.mime_type.startsWith('video/') ? 'video' : 'photo';
      media.push({ type, file_id: doc.file_id });
    }
  }
  
  return media;
}
```

### 2. Обновить handleDraftMessage

```typescript
// Извлечение данных
const text = (message.text || message.caption || "") as string;
const entities = (message.entities || message.caption_entities || []) as object[];
const media = extractMedia(message);

// Сохранение в БД
await supabase.from("deals").update({
  author_draft: text || null,
  author_draft_entities: entities,
  author_draft_media: media,
  is_draft_approved: null,
}).eq("id", deal.id);
```

### 3. Обновить handleRevisionComment

При запросе доработки очищать новые поля:
```typescript
await supabase.from("deals").update({
  author_draft: null,
  author_draft_entities: [],
  author_draft_media: [],
  author_draft_media_urls: [], // оставить для совместимости
  is_draft_approved: false,
  revision_count: (deal.revision_count || 0) + 1,
}).eq("id", deal.id);
```

## Изменения в publish-scheduled-posts/index.ts

### Новая функция публикации с file_id и entities

```typescript
interface MediaItem {
  type: 'photo' | 'video';
  file_id: string;
}

async function publishDraftToChannel(
  chatId: number, 
  text: string,
  entities: object[],
  media: MediaItem[],
  buttonText?: string,
  buttonUrl?: string
): Promise<number> {
  const replyMarkup = buttonText && buttonUrl
    ? { inline_keyboard: [[{ text: buttonText, url: buttonUrl }]] }
    : undefined;

  // Без медиа — только текст с entities
  if (!media || media.length === 0) {
    const result = await sendTelegramRequest("sendMessage", {
      chat_id: chatId,
      text,
      entities, // ← Сохраняет форматирование!
      reply_markup: replyMarkup,
    });
    return result.result.message_id;
  }

  // Одно медиа
  if (media.length === 1) {
    const item = media[0];
    const method = item.type === 'video' ? 'sendVideo' : 'sendPhoto';
    const mediaKey = item.type === 'video' ? 'video' : 'photo';
    
    const result = await sendTelegramRequest(method, {
      chat_id: chatId,
      [mediaKey]: item.file_id, // ← file_id вместо URL!
      caption: text,
      caption_entities: entities, // ← Сохраняет форматирование!
      reply_markup: replyMarkup,
    });
    return result.result.message_id;
  }

  // Несколько медиа
  const mediaGroup = media.map((item, index) => ({
    type: item.type,
    media: item.file_id,
    ...(index === 0 ? { caption: text, caption_entities: entities } : {}),
  }));

  const result = await sendTelegramRequest("sendMediaGroup", {
    chat_id: chatId,
    media: mediaGroup,
  });

  if (replyMarkup) {
    await sendTelegramRequest("sendMessage", {
      chat_id: chatId,
      text: "👆",
      reply_markup: replyMarkup,
    });
  }

  return result.result[0].message_id;
}
```

### Обновить processDeal

```typescript
// Для prompt-кампаний использовать новые поля
if (isPromptCampaign && deal.author_draft) {
  const messageId = await publishDraftToChannel(
    channel.telegram_chat_id,
    deal.author_draft,
    deal.author_draft_entities || [],
    deal.author_draft_media || [],
    null, // prompt-кампании не используют кнопки
    null
  );
  // ...
}
```

## Файлы к изменению

| Файл | Изменение |
|------|-----------|
| Миграция БД | Добавить `author_draft_entities` и `author_draft_media` |
| `telegram-webhook/index.ts` | Сохранять `file_id` + `entities` вместо URL |
| `publish-scheduled-posts/index.ts` | Публиковать с `file_id` + `entities` |

## Результат

- ✅ Premium emoji сохраняются 1 в 1
- ✅ Форматирование (bold, italic, ссылки) не теряется
- ✅ Медиа публикуется всегда (file_id бессрочный)
- ✅ Видео и альбомы работают корректно
- ✅ Не нужно хранить файлы в Storage

