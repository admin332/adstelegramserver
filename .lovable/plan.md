

## Поддержка нескольких постов для промпт-кампаний

Добавляем логику для отправки и одобрения нескольких черновиков, когда рекламодатель заказывает несколько постов с промпт-кампанией.

---

## Текущая проблема

| Что заказал рекламодатель | Что происходит сейчас | Что должно быть |
|---------------------------|----------------------|-----------------|
| 3 поста, промпт-кампания | Владелец получает бриф, шлёт 1 черновик | Владелец должен прислать **3 черновика** |
| | Рекламодатель одобряет 1 черновик | Рекламодатель одобряет **каждый из 3** |
| | Публикуется 1 пост | Публикуется **3 поста** |

---

## Текущая структура данных

```sql
deals:
  - posts_count: 3           -- количество заказанных постов
  - author_draft: text       -- ОДИН черновик (текст)
  - author_draft_entities: jsonb
  - author_draft_media: jsonb
  - is_draft_approved: boolean
```

---

## Новая структура данных

Нужны новые колонки для хранения **массива черновиков**:

```sql
deals:
  - posts_count: 3
  - author_drafts: jsonb     -- МАССИВ черновиков
  -- Формат:
  -- [
  --   { "text": "...", "entities": [...], "media": [...], "approved": null },
  --   { "text": "...", "entities": [...], "media": [...], "approved": true },
  --   { "text": "...", "entities": [...], "media": [...], "approved": null }
  -- ]
  
  -- Старые поля оставить для обратной совместимости
  - author_draft: text (deprecated)
  - author_draft_entities: jsonb (deprecated)
  - author_draft_media: jsonb (deprecated)
  - is_draft_approved: boolean (deprecated)
```

---

## Файлы для изменения

### 1. Миграция базы данных

```sql
-- Новая колонка для массива черновиков
ALTER TABLE deals ADD COLUMN IF NOT EXISTS author_drafts jsonb DEFAULT '[]';
```

---

### 2. `notify-deal-payment/index.ts`

**Изменить функцию `sendPromptBrief`:**

```typescript
async function sendPromptBrief(
  telegramId: number, 
  campaign: Deal['campaign'],
  postsCount: number  // новый параметр
) {
  if (!campaign) return;
  
  const { text, button_url } = campaign;
  
  const postsWord = getPostsWord(postsCount);
  
  let briefMessage = `📋 <b>Бриф от рекламодателя:</b>\n\n${text}`;
  
  if (button_url) {
    briefMessage += `\n\n🔗 <b>Ссылка на продукт:</b> ${button_url}`;
  }
  
  if (postsCount > 1) {
    briefMessage += `\n\n📝 <b>Нужно написать ${postsCount} ${postsWord}</b>`;
    briefMessage += `\nОтправляйте готовые посты по одному в этот чат.`;
    briefMessage += `\n\n<i>После каждого поста рекламодатель проверит и одобрит его.</i>`;
  } else {
    briefMessage += `\n\n✍️ <b>Напишите пост по этому брифу</b>\nОтправьте текст и медиа в этот чат.`;
  }
  
  await sendTelegramRequest("sendMessage", {
    chat_id: telegramId,
    text: briefMessage,
    parse_mode: "HTML",
    disable_web_page_preview: false,
  });
}
```

**Передать `posts_count`:**

```typescript
if (isPromptCampaign) {
  await sendPromptBrief(ownerTelegramId, typedDeal.campaign, typedDeal.posts_count);
} else {
  await sendCampaignPreview(ownerTelegramId, typedDeal.campaign);
}
```

---

### 3. `telegram-webhook/index.ts`

**Изменить `handleDraftMessage`:**

```typescript
async function handleDraftMessage(telegramUserId: number, message: Record<string, unknown>) {
  // ... получение пользователя и сделки ...
  
  // Получить текущее состояние черновиков
  const currentDrafts = deal.author_drafts || [];
  const requiredCount = deal.posts_count;
  const approvedCount = currentDrafts.filter(d => d.approved === true).length;
  const pendingCount = currentDrafts.filter(d => d.approved === null).length;
  const submittedCount = currentDrafts.length;
  
  // Проверить, нужны ли ещё черновики
  if (submittedCount >= requiredCount) {
    await sendTelegramMessage(
      telegramUserId, 
      `📭 Все ${requiredCount} постов уже отправлены.\n\nОжидайте проверки рекламодателем.`
    );
    return;
  }
  
  // Извлечь контент
  const text = (message.text || message.caption || "") as string;
  const entities = (message.entities || message.caption_entities || []) as object[];
  const media = extractMedia(message);
  
  // Добавить новый черновик в массив
  const newDraft = {
    index: submittedCount,
    text: text || null,
    entities,
    media,
    approved: null,  // ожидает проверки
    message_id: message.message_id,
    chat_id: (message.chat as { id: number }).id,
  };
  
  const updatedDrafts = [...currentDrafts, newDraft];
  
  // Сохранить в БД
  await supabase
    .from("deals")
    .update({ author_drafts: updatedDrafts })
    .eq("id", deal.id);
  
  // Уведомить рекламодателя о новом черновике
  const draftNumber = submittedCount + 1;
  await sendTelegramMessage(
    advertiser.telegram_id,
    `📝 <b>Черновик ${draftNumber} из ${requiredCount}</b>\n\nАвтор канала отправил пост. Проверьте ниже:`
  );
  
  // Переслать черновик
  await copyMessage(advertiser.telegram_id, message.chat.id, message.message_id);
  
  // Кнопки одобрения
  await sendTelegramMessage(
    advertiser.telegram_id,
    `👆 <b>Проверьте черновик ${draftNumber}</b>`,
    {
      inline_keyboard: [
        [
          { text: "✅ Одобрить", callback_data: `approve_draft:${deal.id}:${draftNumber - 1}` },
          { text: "✏️ На доработку", callback_data: `revise_draft:${deal.id}:${draftNumber - 1}` }
        ]
      ]
    }
  );
  
  // Подтвердить владельцу
  const remaining = requiredCount - draftNumber;
  let ownerMessage = `✅ <b>Черновик ${draftNumber} из ${requiredCount} отправлен!</b>`;
  
  if (remaining > 0) {
    ownerMessage += `\n\nОсталось отправить: ${remaining} ${getPostsWord(remaining)}`;
  } else {
    ownerMessage += `\n\n🎉 Все посты отправлены! Ожидайте проверки.`;
  }
  
  await sendTelegramMessage(telegramUserId, ownerMessage);
}
```

---

### 4. Изменить обработчики одобрения

**`handleDraftApproval` — работа с массивом:**

```typescript
async function handleDraftApproval(
  callbackQueryId: string, 
  dealId: string, 
  draftIndex: number,  // новый параметр: индекс черновика
  from: { id: number }, 
  message: { chat: { id: number }; message_id: number }
) {
  // ... проверки ...
  
  // Обновить конкретный черновик в массиве
  const drafts = deal.author_drafts || [];
  if (draftIndex >= drafts.length) {
    await answerCallbackQuery(callbackQueryId, "Черновик не найден");
    return;
  }
  
  drafts[draftIndex].approved = true;
  
  // Проверить, все ли черновики одобрены
  const allApproved = drafts.length === deal.posts_count && 
                      drafts.every(d => d.approved === true);
  
  await supabase
    .from("deals")
    .update({ 
      author_drafts: drafts,
      // Переводим в in_progress только когда ВСЕ одобрены
      ...(allApproved && { status: "in_progress", is_draft_approved: true })
    })
    .eq("id", dealId);
  
  // Уведомления
  await editMessageReplyMarkup(message.chat.id, message.message_id);
  
  const draftNumber = draftIndex + 1;
  const approvedCount = drafts.filter(d => d.approved === true).length;
  
  if (allApproved) {
    // Все одобрены
    await sendTelegramMessage(from.id, 
      `✅ <b>Все ${deal.posts_count} постов одобрены!</b>\n\nПубликация будет выполнена автоматически.`
    );
    
    // Уведомить владельца
    await sendTelegramMessage(owner.telegram_id,
      `🎉 <b>Все посты одобрены!</b>\n\nРекламодатель принял все ${deal.posts_count} постов. Ожидайте публикации.`
    );
  } else {
    await sendTelegramMessage(from.id,
      `✅ Черновик ${draftNumber} одобрен!\n\nОдобрено: ${approvedCount} из ${deal.posts_count}`
    );
  }
}
```

---

### 5. Изменить `publish-scheduled-posts`

**Публикация всех постов из массива:**

```typescript
async function processDeal(deal: Deal): Promise<{ success: boolean; error?: string }> {
  const campaign = await getCampaign(deal.campaign_id);
  const channel = await getChannel(deal.channel_id);
  const isPromptCampaign = campaign.campaign_type === "prompt";
  
  let messageIds: number[] = [];
  
  if (isPromptCampaign && deal.author_drafts?.length > 0) {
    // Публикуем ВСЕ одобренные черновики из массива
    for (const draft of deal.author_drafts) {
      if (draft.approved !== true) continue;
      
      const messageId = await publishDraftToChannel(
        channel.telegram_chat_id,
        draft.text,
        draft.entities || [],
        draft.media || [],
        null,
        null
      );
      messageIds.push(messageId);
      
      // Небольшая задержка между постами
      await new Promise(r => setTimeout(r, 1000));
    }
  } else {
    // ready_post — один пост
    const messageId = await publishToChannel(channel.telegram_chat_id, campaign);
    messageIds.push(messageId);
  }
  
  // Сохранить все message_id
  await supabase
    .from("deals")
    .update({
      posted_at: new Date().toISOString(),
      telegram_message_id: messageIds[0], // первый для обратной совместимости
      telegram_message_ids: messageIds,   // новое поле — массив
    })
    .eq("id", deal.id);
}
```

---

## Визуальный флоу

```text
Рекламодатель заказывает 3 поста (промпт)
          │
          ▼
┌─────────────────────────────────────┐
│  Владелец получает бриф:            │
│  "Нужно написать 3 поста"           │
│  "Отправляйте по одному"            │
└─────────────────────────────────────┘
          │
          ▼
Владелец отправляет пост #1 → Рекламодатель: [Одобрить] [На доработку]
          │
          ▼
Владелец отправляет пост #2 → Рекламодатель: [Одобрить] [На доработку]
          │
          ▼
Владелец отправляет пост #3 → Рекламодатель: [Одобрить] [На доработку]
          │
          ▼
Все 3 одобрены → Статус: in_progress
          │
          ▼
По расписанию публикуются все 3 поста
```

---

## Миграция данных

Добавить колонки:

```sql
ALTER TABLE deals ADD COLUMN IF NOT EXISTS author_drafts jsonb DEFAULT '[]';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS telegram_message_ids jsonb DEFAULT '[]';
```

---

## Результат

- Владелец канала получает понятное сообщение "нужно N постов"
- Каждый черновик отправляется и проверяется отдельно
- Рекламодатель одобряет каждый пост индивидуально
- Только после одобрения ВСЕХ постов сделка переходит в `in_progress`
- При публикации отправляются ВСЕ одобренные посты

