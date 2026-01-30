

## Обзор

Для корректной работы MTProto-статистики аккаунт @kjeuz должен быть администратором канала. Добавим соответствующий пункт в инструкции и проверку в процесс верификации.

---

## Изменения

### 1. UI: Добавить 4-й пункт в инструкции (AddChannelWizard.tsx)

В разделе `Step 1: Instructions` (строки 261-277) добавить новый пункт:

```text
Инструкция:
1. Откройте настройки вашего канала в Telegram
2. Перейдите в раздел «Администраторы»
3. Добавьте @adsingo_bot как администратора
4. Добавьте @kjeuz как администратора (для детальной аналитики)  ← НОВЫЙ ПУНКТ
```

Также добавить вторую ссылку для быстрого доступа к @kjeuz.

---

### 2. Backend: Проверка @kjeuz в verify-channel Edge Function

Добавить дополнительную проверку статуса @kjeuz в канале:

1. Получить Telegram ID пользователя @kjeuz (необходимо добавить как константу или переменную окружения)
2. Вызвать `getChatMember(botToken, chat.id, kjeuzUserId)`
3. Если @kjeuz не является администратором — вернуть ошибку с понятным сообщением

---

## Техническая реализация

### AddChannelWizard.tsx

Добавить 4-й пункт инструкции и ссылку:

```tsx
<li className="flex gap-3">
  <span className="...">4</span>
  <span>Добавьте <span className="text-primary font-medium">@kjeuz</span> как администратора (для детальной аналитики)</span>
</li>
```

Добавить вторую ссылку после ссылки на @adsingo_bot:

```tsx
<a href="https://t.me/kjeuz" target="_blank" ...>
  Открыть @kjeuz
  <ExternalLink className="w-4 h-4" />
</a>
```

---

### verify-channel/index.ts

1. Добавить константу с ID пользователя @kjeuz (необходимо получить его Telegram ID)
2. После проверки бота добавить аналогичную проверку для @kjeuz:

```typescript
// Telegram ID @kjeuz (MTProto session owner for analytics)
const MTPROTO_ADMIN_ID = XXXXXXXXX; // Нужно узнать ID

// Check if MTProto admin (@kjeuz) is added as admin
const mtprotoMember = await getChatMember(botToken, chat.id, MTPROTO_ADMIN_ID);
const mtprotoIsAdmin = mtprotoMember && 
  ["creator", "administrator"].includes(mtprotoMember.status);

if (!mtprotoIsAdmin) {
  return new Response(
    JSON.stringify({ 
      success: false, 
      error: "Пользователь @kjeuz не добавлен как администратор канала. Это необходимо для получения детальной статистики.",
      botCanPost: true,
      userIsAdmin: true,
      mtprotoIsAdmin: false
    }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

---

## Что потребуется от вас

**Telegram ID пользователя @kjeuz** — это числовой идентификатор. Вы можете получить его:
- Через бота @userinfobot в Telegram
- Или он уже известен из вашей MTProto-сессии

Без этого ID невозможно проверить статус через Bot API.

---

## Порядок изменений

| # | Файл | Действие |
|---|------|----------|
| 1 | `src/components/create/AddChannelWizard.tsx` | Добавить 4-й пункт инструкции + ссылку |
| 2 | `supabase/functions/verify-channel/index.ts` | Добавить проверку статуса @kjeuz |
| 3 | Секреты (опционально) | Добавить `MTPROTO_ADMIN_TELEGRAM_ID` |

