

## Цель
Отправлять уведомление владельцу канала в Telegram, когда новый менеджер присоединяется к команде.

## Изменения

### Обновить Edge Function `join-channel-as-admin`

**Файл**: `supabase/functions/join-channel-as-admin/index.ts`

После успешного добавления менеджера (строка 238), добавить логику отправки уведомления владельцу:

#### Шаг 1: Найти владельца канала
```typescript
// Получить владельца канала (role = 'owner')
const { data: ownerAdmin } = await supabase
  .from("channel_admins")
  .select("user_id")
  .eq("channel_id", channel.id)
  .eq("role", "owner")
  .maybeSingle();
```

#### Шаг 2: Получить telegram_id владельца
```typescript
if (ownerAdmin && ownerAdmin.user_id !== userData.id) {
  // Получить telegram_id владельца
  const { data: ownerUser } = await supabase
    .from("users")
    .select("telegram_id, first_name")
    .eq("id", ownerAdmin.user_id)
    .single();
```

#### Шаг 3: Получить данные нового менеджера
```typescript
  // Получить данные нового менеджера для уведомления
  const { data: newManager } = await supabase
    .from("users")
    .select("first_name, last_name, username")
    .eq("id", userData.id)
    .single();
```

#### Шаг 4: Отправить уведомление через Telegram Bot API
```typescript
  if (ownerUser?.telegram_id && newManager) {
    const managerName = [newManager.first_name, newManager.last_name]
      .filter(Boolean)
      .join(" ");
    const managerUsername = newManager.username ? `@${newManager.username}` : "";
    
    const notificationText = `🆕 <b>Новый менеджер в команде!</b>

Канал: <b>${channel.title}</b>

Присоединился: <b>${managerName}</b>${managerUsername ? ` (${managerUsername})` : ""}

Теперь этот пользователь может управлять рекламой на вашем канале.`;

    try {
      await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: ownerUser.telegram_id,
            text: notificationText,
            parse_mode: "HTML",
          }),
        }
      );
      console.log(`[join-channel-as-admin] Notification sent to owner ${ownerUser.telegram_id}`);
    } catch (notifyError) {
      // Не блокируем основной процесс если уведомление не отправилось
      console.error("[join-channel-as-admin] Failed to notify owner:", notifyError);
    }
  }
}
```

## Текст уведомления

```
🆕 Новый менеджер в команде!

Канал: ИМЯ_КАНАЛА

Присоединился: Имя Фамилия (@username)

Теперь этот пользователь может управлять рекламой на вашем канале.
```

## Важные моменты

1. **Не блокировать основной процесс** - если уведомление не отправилось (пользователь заблокировал бота), операция добавления менеджера всё равно завершится успешно

2. **Не уведомлять самого себя** - проверка `ownerAdmin.user_id !== userData.id` исключает случай, когда владелец сам присоединяется к своему каналу

3. **Graceful handling** - ошибки отправки уведомления логируются, но не прерывают основной flow

## Результат

- Владелец канала получит личное сообщение от бота @adsingo_bot
- В сообщении будет имя и username нового менеджера
- Владелец сразу узнает, кто присоединился к его команде

