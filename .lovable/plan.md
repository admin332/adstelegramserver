

## План: Выбор версии черновика рекламодателем

### Текущее поведение
- При запросе доработки все черновики сбрасываются (`author_drafts: []`)
- Предыдущие версии теряются
- Рекламодатель видит только последнюю версию

### Новое поведение
- При каждой ревизии предыдущие черновики сохраняются в историю
- Рекламодатель видит кнопки выбора версии: "Вариант 1", "Вариант 2", "Вариант 3"
- При выборе версии владельцу приходит уведомление какой вариант выбрал рекламодатель
- Публикуется выбранная версия

---

## Технические изменения

### 1. Миграция базы данных

Добавить поле для хранения истории версий:

```sql
ALTER TABLE deals ADD COLUMN draft_history jsonb DEFAULT '[]'::jsonb;
```

Структура `draft_history`:
```typescript
interface DraftHistoryItem {
  version: number;           // 1, 2, 3
  text: string | null;
  entities: object[];
  media: MediaItem[];
  message_id: number;
  chat_id: number;
  submitted_at: string;      // ISO timestamp
}
```

### 2. Обновление telegram-webhook/index.ts

**При отправке черновика - сохранять в историю:**

В функции `handleDraftMessage` перед очисткой добавить:

```typescript
// Save current draft to history before clearing (on revision)
if (deal.revision_count > 0 && deal.author_drafts?.length > 0) {
  const historyItem = {
    version: deal.revision_count,
    drafts: deal.author_drafts,
    submitted_at: deal.draft_submitted_at
  };
  // This is handled in handleRevisionComment
}
```

**При запросе ревизии - не терять старые черновики:**

В функции `handleRevisionComment` изменить:

```typescript
// Get current drafts before clearing
const currentDrafts = (deal.author_drafts as DraftItem[]) || [];
const currentHistory = (deal.draft_history as DraftHistoryItem[]) || [];

// Save current version to history if exists
if (currentDrafts.length > 0) {
  const historyEntry = {
    version: (deal.revision_count || 0) + 1,
    drafts: currentDrafts,
    submitted_at: new Date().toISOString(),
  };
  currentHistory.push(historyEntry);
}

// Update deal
const { error: updateError } = await supabase
  .from("deals")
  .update({
    is_draft_approved: false,
    author_draft: null,
    author_draft_entities: [],
    author_draft_media: [],
    author_draft_media_urls: [],
    author_drafts: [],
    draft_history: currentHistory,  // ← Сохраняем историю
    revision_count: (deal.revision_count || 0) + 1,
  })
  .eq("id", dealId);
```

**Изменить кнопки одобрения когда есть история:**

При отправке нового черновика, если `revision_count > 0`, показывать кнопки выбора версии:

```typescript
// After sending current draft for approval
if (historyCount > 0) {
  const versionButtons = [];
  
  // Add history version buttons
  for (let i = 1; i <= historyCount; i++) {
    versionButtons.push({
      text: `📄 Вариант ${i}`,
      callback_data: `select_version:${deal.id}:${i}`
    });
  }
  
  // Current version button
  versionButtons.push({
    text: `📄 Вариант ${historyCount + 1} (текущий)`,
    callback_data: `select_version:${deal.id}:${historyCount + 1}`
  });

  await sendTelegramMessage(
    advertiser.telegram_id,
    `📋 <b>Доступные версии:</b>\n\nВыберите версию поста для публикации:`,
    { inline_keyboard: [versionButtons] }
  );
}
```

### 3. Новый callback handler: handleVersionSelect

```typescript
async function handleVersionSelect(
  callbackQueryId: string,
  dealId: string,
  version: number,
  from: { id: number },
  message: { chat: { id: number }; message_id: number }
) {
  // Get deal with history
  const { data: deal } = await supabase
    .from("deals")
    .select("id, status, advertiser_id, channel_id, revision_count, author_drafts, draft_history")
    .eq("id", dealId)
    .single();

  // Verify user is advertiser
  if (deal.advertiser_id !== user.id) {
    await answerCallbackQuery(callbackQueryId, "Только рекламодатель может выбрать версию");
    return;
  }

  const history = (deal.draft_history as DraftHistoryItem[]) || [];
  const currentVersion = (deal.revision_count || 0) + 1;
  
  let selectedDrafts: DraftItem[];
  
  if (version === currentVersion) {
    // Use current drafts
    selectedDrafts = deal.author_drafts;
  } else {
    // Use history version
    const historyEntry = history.find(h => h.version === version);
    if (!historyEntry) {
      await answerCallbackQuery(callbackQueryId, "Версия не найдена");
      return;
    }
    selectedDrafts = historyEntry.drafts;
  }

  // Update deal with selected version
  await supabase
    .from("deals")
    .update({
      author_drafts: selectedDrafts.map(d => ({ ...d, approved: true })),
      is_draft_approved: true,
      status: "in_progress",
      selected_version: version,  // Optional: track which version was selected
    })
    .eq("id", dealId);

  // Notify channel owner which version was selected
  const { data: channel } = await supabase
    .from("channels")
    .select("owner_id, title, username")
    .eq("id", deal.channel_id)
    .single();

  const { data: owner } = await supabase
    .from("users")
    .select("telegram_id")
    .eq("id", channel?.owner_id)
    .single();

  if (owner?.telegram_id) {
    const channelName = channel?.title || `@${channel?.username}`;
    const message = version === currentVersion
      ? `✅ <b>Рекламодатель выбрал текущую версию!</b>\n\nВаш последний черновик для канала <b>${channelName}</b> одобрен.\nПост будет опубликован по расписанию.`
      : `✅ <b>Рекламодатель выбрал Вариант ${version}!</b>\n\nДля канала <b>${channelName}</b> будет опубликована предыдущая версия поста (не последняя).\n\nПубликация по расписанию.`;
    
    await sendTelegramMessage(owner.telegram_id, message);
  }

  // Confirm to advertiser
  await answerCallbackQuery(callbackQueryId, `Вариант ${version} выбран!`);
  
  // Remove buttons
  await editMessageReplyMarkup(message.chat.id, message.message_id);
}
```

### 4. Обработка нового callback в main handler

```typescript
// In callback_query handling section
if (data.startsWith("select_version:")) {
  const [, dealId, versionStr] = data.split(":");
  await handleVersionSelect(callbackQueryId, dealId, parseInt(versionStr), from, message);
  return;
}
```

### 5. Обновление типов (опционально)

```typescript
interface DraftHistoryItem {
  version: number;
  drafts: DraftItem[];
  submitted_at: string;
}
```

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| **Миграция БД** | Добавить `draft_history` jsonb |
| `supabase/functions/telegram-webhook/index.ts` | Сохранение истории, кнопки выбора, новый handler |
| `supabase/functions/user-deals/index.ts` | Добавить `draft_history` в select (опционально) |

---

## UX флоу

```text
Черновик 1 → Рекламодатель: "На доработку"
  └─ История: [{ version: 1, drafts: [...] }]
  
Черновик 2 → Рекламодатель видит:
  ├─ [📄 Вариант 1]
  ├─ [📄 Вариант 2 (текущий)]
  └─ [✅ Одобрить текущий]
  
Рекламодатель нажимает "Вариант 1"
  └─ Владельцу: "Рекламодатель выбрал Вариант 1!"
  └─ Публикуется Вариант 1
```

---

## Пример уведомлений

**Рекламодателю (после 2-й ревизии):**
```
📝 Черновик поста от @channel

[Текст черновика]

📋 Доступные версии:
Выберите версию для публикации:

[📄 Вариант 1] [📄 Вариант 2] [📄 Вариант 3 (текущий)]
```

**Владельцу канала (при выборе старой версии):**
```
✅ Рекламодатель выбрал Вариант 1!

Для канала MyChannel будет опубликована версия 1 (не последняя).

Публикация по расписанию.
```

