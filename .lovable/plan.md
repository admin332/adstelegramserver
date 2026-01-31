
## Исправление: Сохранение состояния запроса на доработку в базе данных

### Корневая причина проблемы

Сейчас состояние "ожидание комментария для доработки" хранится **в памяти** Edge Function:

```typescript
// In-memory state (will reset on function restart, but that's OK for this use case)
const userStates: Map<number, UserState> = new Map();
```

**Проблема:** Supabase Edge Functions **stateless** — каждый запрос может обрабатываться разным экземпляром функции!

Поток сбоя:
1. Рекламодатель нажимает "На доработку" → запрос идёт на инстанс A → `userStates.set(userId, {dealId, step: 'awaiting_revision'})` в памяти A
2. Рекламодатель пишет комментарий → запрос идёт на инстанс B → `userStates.get(userId)` возвращает `undefined`
3. Код падает в `handleDraftMessage` который ищет сделки где пользователь — **владелец канала**, а не рекламодатель
4. Выводит "📭 Нет сделок, ожидающих черновика"

---

### Решение

Хранить состояние `awaiting_revision` в **базе данных** вместо памяти.

---

## План изменений

### 1. Добавить таблицу `telegram_user_states`

Для хранения состояния диалога с пользователями бота.

```sql
CREATE TABLE IF NOT EXISTS telegram_user_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT NOT NULL UNIQUE,
  state_type TEXT NOT NULL,  -- 'awaiting_revision'
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  draft_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '1 hour')
);

-- Enable RLS
ALTER TABLE telegram_user_states ENABLE ROW LEVEL SECURITY;

-- Service role only policy
CREATE POLICY "Service role can manage telegram_user_states"
  ON telegram_user_states
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for fast lookup
CREATE INDEX idx_telegram_user_states_telegram_user_id 
  ON telegram_user_states(telegram_user_id);

-- Auto-cleanup expired states (optional trigger)
CREATE OR REPLACE FUNCTION cleanup_expired_user_states()
RETURNS trigger AS $$
BEGIN
  DELETE FROM telegram_user_states WHERE expires_at < now();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

---

### 2. Обновить `supabase/functions/telegram-webhook/index.ts`

#### 2.1 Удалить in-memory `userStates`

```typescript
// УДАЛИТЬ эти строки:
interface UserState {
  dealId: string;
  step: 'awaiting_draft' | 'awaiting_revision';
  advertiserTelegramId?: number;
}
const userStates: Map<number, UserState> = new Map();
```

#### 2.2 Новая функция: сохранить состояние в БД

```typescript
async function setUserState(
  telegramUserId: number, 
  stateType: string, 
  dealId: string, 
  draftIndex: number = 0
) {
  await supabase
    .from('telegram_user_states')
    .upsert({
      telegram_user_id: telegramUserId,
      state_type: stateType,
      deal_id: dealId,
      draft_index: draftIndex,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
    }, {
      onConflict: 'telegram_user_id'
    });
}
```

#### 2.3 Новая функция: получить состояние из БД

```typescript
async function getUserState(telegramUserId: number) {
  const { data } = await supabase
    .from('telegram_user_states')
    .select('state_type, deal_id, draft_index')
    .eq('telegram_user_id', telegramUserId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  
  return data;
}
```

#### 2.4 Новая функция: удалить состояние

```typescript
async function clearUserState(telegramUserId: number) {
  await supabase
    .from('telegram_user_states')
    .delete()
    .eq('telegram_user_id', telegramUserId);
}
```

#### 2.5 Обновить `handleDraftRevision` (строки ~580-648)

```typescript
async function handleDraftRevision(...) {
  // ... existing code ...
  
  // БЫЛО:
  // userStates.set(from.id, { dealId, step: 'awaiting_revision', ... });
  
  // СТАНЕТ:
  await setUserState(from.id, 'awaiting_revision', dealId, draftIndex);
  
  // ... rest of function ...
}
```

#### 2.6 Обновить `handleRevisionComment` (строки ~650-731)

```typescript
async function handleRevisionComment(telegramUserId: number, text: string) {
  // БЫЛО:
  // const state = userStates.get(telegramUserId);
  
  // СТАНЕТ:
  const state = await getUserState(telegramUserId);
  
  if (!state || state.state_type !== 'awaiting_revision') {
    return false;
  }
  
  const dealId = state.deal_id;
  
  // БЫЛО:
  // userStates.delete(telegramUserId);
  
  // СТАНЕТ:
  await clearUserState(telegramUserId);
  
  // ... rest of function ...
}
```

#### 2.7 Обновить `handleCancelRevision` (строки ~733-744)

```typescript
async function handleCancelRevision(callbackQueryId: string, dealId: string, from: { id: number }) {
  // БЫЛО:
  // userStates.delete(from.id);
  
  // СТАНЕТ:
  await clearUserState(from.id);
  
  // ... rest of function ...
}
```

#### 2.8 Обновить main handler (строки ~1177-1184)

```typescript
// Check if user is in revision comment mode
// БЫЛО:
// const state = userStates.get(telegramUserId);
// if (state?.step === 'awaiting_revision' && message.text) {

// СТАНЕТ:
const state = await getUserState(telegramUserId);
if (state?.state_type === 'awaiting_revision' && message.text) {
  const handled = await handleRevisionComment(telegramUserId, message.text);
  if (handled) {
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  }
}
```

---

### 3. Добавить кнопки обратно после отмены доработки

В `handleCancelRevision` сейчас отправляется только текст без кнопок. Нужно добавить кнопки "Одобрить" / "На доработку":

```typescript
async function handleCancelRevision(callbackQueryId: string, dealId: string, from: { id: number }) {
  // Получаем состояние для получения draft_index
  const state = await getUserState(from.id);
  const draftIndex = state?.draft_index || 0;
  
  await clearUserState(from.id);
  
  // Отправляем сообщение с кнопками
  await sendTelegramMessage(
    from.id,
    "❌ Запрос на доработку отменён.\n\nВы можете снова проверить черновик:",
    {
      inline_keyboard: [
        [
          { text: "✅ Одобрить", callback_data: `approve_draft:${dealId}:${draftIndex}` },
          { text: "✏️ На доработку", callback_data: `revise_draft:${dealId}:${draftIndex}` }
        ]
      ]
    }
  );
  
  await answerCallbackQuery(callbackQueryId, "Отменено");
}
```

---

## Схема данных

| Таблица | Поля |
|---------|------|
| `telegram_user_states` | `telegram_user_id`, `state_type`, `deal_id`, `draft_index`, `expires_at` |

---

## Итоговый поток после исправления

```text
1. Рекламодатель нажимает "На доработку"
   → Сохраняется состояние в БД: {telegram_user_id, state_type: 'awaiting_revision', deal_id}
   
2. Рекламодатель пишет комментарий  
   → Любой инстанс Edge Function читает состояние из БД
   → Находит deal_id, обрабатывает комментарий
   → Удаляет состояние из БД
   
3. Если рекламодатель нажимает "Отмена"
   → Удаляет состояние из БД
   → Показывает кнопки "Одобрить" / "На доработку" снова
```

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| **Миграция БД** | Создать таблицу `telegram_user_states` |
| `supabase/functions/telegram-webhook/index.ts` | Заменить in-memory state на функции работы с БД |

---

## Технические детали

1. **Почему `expires_at`?** — Чтобы старые записи автоматически становились недействительными (например, если пользователь не завершил действие)

2. **Почему `UNIQUE` на `telegram_user_id`?** — У пользователя может быть только одно активное состояние

3. **Почему `ON DELETE CASCADE` для `deal_id`?** — Если сделка удалена, состояние удаляется автоматически
