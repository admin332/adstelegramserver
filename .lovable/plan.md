

## Исправление автоопределения каналов

---

## Проблема

При наличии webhook нельзя использовать `getUpdates` - Telegram возвращает ошибку:
```
"Conflict: can't use getUpdates method while webhook is active"
```

Решение: сохранять события добавления бота в базу данных через webhook, а затем читать их оттуда.

---

## Архитектура решения

```text
ТЕКУЩИЙ ПОТОК (не работает):
  detect-bot-channels → getUpdates ❌ (конфликт с webhook)

НОВЫЙ ПОТОК:
  1. Telegram → telegram-webhook → сохранить my_chat_member в БД
  2. detect-bot-channels → читать из БД → проверить права → вернуть каналы
```

---

## Изменения

### 1. Создать таблицу `pending_channel_verifications`

```sql
CREATE TABLE public.pending_channel_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id BIGINT NOT NULL,
  chat_title TEXT,
  chat_username TEXT,
  added_by_telegram_id BIGINT NOT NULL,
  bot_status TEXT NOT NULL DEFAULT 'administrator',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed BOOLEAN DEFAULT false,
  
  UNIQUE(telegram_chat_id, added_by_telegram_id)
);

-- RLS: только сервисный ключ
ALTER TABLE public.pending_channel_verifications ENABLE ROW LEVEL SECURITY;

-- Индекс для быстрого поиска
CREATE INDEX idx_pending_verifications_user 
  ON public.pending_channel_verifications(added_by_telegram_id, processed);
```

### 2. Обновить `telegram-webhook/index.ts`

Добавить обработку `my_chat_member` событий сразу после получения body:

```typescript
// После строки console.log("Received webhook:", ...)

// Handle my_chat_member (bot added to channel)
if (body.my_chat_member) {
  const { chat, new_chat_member, from } = body.my_chat_member;
  
  // Only process channels where bot became administrator
  if (chat.type === 'channel' && 
      new_chat_member.user?.is_bot && 
      (new_chat_member.status === 'administrator' || new_chat_member.status === 'creator')) {
    
    console.log(`Bot added to channel ${chat.id} (${chat.title}) by user ${from.id}`);
    
    // Save to pending_channel_verifications
    await supabase
      .from('pending_channel_verifications')
      .upsert({
        telegram_chat_id: chat.id,
        chat_title: chat.title || null,
        chat_username: chat.username || null,
        added_by_telegram_id: from.id,
        bot_status: new_chat_member.status,
        detected_at: new Date().toISOString(),
        processed: false,
      }, {
        onConflict: 'telegram_chat_id,added_by_telegram_id'
      });
  }
  
  // Also handle bot removal
  if (chat.type === 'channel' && 
      new_chat_member.user?.is_bot && 
      (new_chat_member.status === 'left' || new_chat_member.status === 'kicked')) {
    
    console.log(`Bot removed from channel ${chat.id} by user ${from.id}`);
    
    // Mark as processed (or delete)
    await supabase
      .from('pending_channel_verifications')
      .update({ processed: true })
      .eq('telegram_chat_id', chat.id);
  }
  
  return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
}
```

### 3. Обновить `detect-bot-channels/index.ts`

Заменить вызов `getUpdates` на чтение из таблицы:

```typescript
// БЫЛО:
const updatesResponse = await fetch(
  `https://api.telegram.org/bot${botToken}/getUpdates?offset=-100...`
);

// СТАЛО:
// 1. Получить pending верификации для этого пользователя
const pendingResponse = await fetch(
  `${supabaseUrl}/rest/v1/pending_channel_verifications?added_by_telegram_id=eq.${userTelegramId}&processed=eq.false&select=*`,
  {
    headers: {
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
    }
  }
);
const pendingChannels = await pendingResponse.json();

console.log(`Found ${pendingChannels.length} pending verifications for user`);

// 2. Для каждого канала проверить что user тоже админ
for (const pending of pendingChannels) {
  const chatId = pending.telegram_chat_id;
  
  // Проверить что пользователь админ
  const memberResponse = await fetch(
    `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${chatId}&user_id=${userTelegramId}`
  );
  // ... остальная логика проверки
}
```

---

## Логика работы

```text
Шаг 1: Пользователь добавляет @adsingo_bot в канал
        ↓
Шаг 2: Telegram отправляет my_chat_member в webhook
        ↓
Шаг 3: telegram-webhook сохраняет в pending_channel_verifications:
       {chat_id, title, username, added_by_telegram_id}
        ↓
Шаг 4: Пользователь нажимает "Готово, далее" в приложении
        ↓
Шаг 5: detect-bot-channels читает pending_channel_verifications
       для telegram_id пользователя
        ↓
Шаг 6: Для каждого канала проверяет getChatMember (права)
        ↓
Шаг 7: Возвращает найденные каналы с статистикой
```

---

## Файлы для изменения

| Файл | Действие |
|------|----------|
| Миграция БД | Создать таблицу `pending_channel_verifications` |
| `supabase/functions/telegram-webhook/index.ts` | Добавить обработку `my_chat_member` |
| `supabase/functions/detect-bot-channels/index.ts` | Заменить getUpdates на чтение из БД |

---

## Преимущества нового подхода

| Старый (getUpdates) | Новый (webhook + БД) |
|---------------------|----------------------|
| Не работает с webhook | Работает всегда |
| Данные хранятся 24ч | Данные хранятся постоянно |
| Нет истории | Можно отслеживать историю |
| Один запрос = все каналы | Фильтрация по пользователю |

