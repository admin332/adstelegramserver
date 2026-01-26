

## План: Исправление логики добавления модераторов к существующим каналам

### Проблема

При попытке модератора добавить канал `@newstutox` система выдаёт ошибку "Этот канал уже зарегистрирован", вместо того чтобы добавить его как менеджера.

**Причины:**
1. Таблица `channel_admins` пуста — каналы были созданы ДО миграции
2. Функция `verify-channel` не обрабатывает случай "канал существует, но пользователь — админ в Telegram"

---

### Текущий флоу (неправильный)

```text
Модератор добавляет канал
         ↓
verify-channel проверяет: канал существует?
         ↓
Да → Ошибка: "Канал уже зарегистрирован" ❌
```

### Правильный флоу

```text
Модератор добавляет канал
         ↓
verify-channel проверяет: канал существует?
         ↓
Да → Проверить: пользователь админ в Telegram?
         ↓
Да → Добавить в channel_admins как manager ✅
         ↓
Вернуть успех: "Вы добавлены как менеджер"
```

---

### Изменения

| Файл | Действие | Описание |
|------|----------|----------|
| `supabase/functions/verify-channel/index.ts` | Изменить | При существующем канале — добавлять как менеджера |
| **SQL миграция** | Создать | Заполнить `channel_admins` для существующих каналов |
| `src/components/create/AddChannelWizard.tsx` | Изменить | Показать корректное сообщение при добавлении как менеджера |

---

### 1. Изменение verify-channel

Вместо текущего:
```typescript
if (existingChannel) {
  return Response({ error: "Этот канал уже зарегистрирован" });
}
```

Новая логика:
```typescript
if (existingChannel) {
  // Канал существует — проверяем, можно ли добавить пользователя как менеджера
  
  // 1. Проверить, уже есть ли пользователь в channel_admins
  const { data: existingAdmin } = await supabase
    .from("channel_admins")
    .select("id, role")
    .eq("channel_id", existingChannel.id)
    .eq("user_id", userData.id)
    .maybeSingle();

  if (existingAdmin) {
    return Response({
      success: true,
      message: "Вы уже являетесь администратором этого канала",
      role: existingAdmin.role,
      isExistingAdmin: true,
      channel: existingChannel
    });
  }

  // 2. Проверить права в Telegram (уже сделано выше — userIsAdmin)
  if (!userIsAdmin) {
    return Response({ error: "Вы не являетесь администратором этого канала" });
  }

  // 3. Добавить как менеджера (не owner, потому что owner уже есть)
  const isCreator = userMember?.status === "creator";
  const role = isCreator ? "owner" : "manager";
  
  const { error: adminInsertError } = await supabase
    .from("channel_admins")
    .insert({
      channel_id: existingChannel.id,
      user_id: userData.id,
      role,
      telegram_member_status: userMember?.status,
      permissions: role === "owner"
        ? { can_edit_posts: true, can_view_stats: true, can_view_finance: true, can_withdraw: true, can_manage_admins: true }
        : { can_edit_posts: true, can_view_stats: true, can_view_finance: false, can_withdraw: false, can_manage_admins: false },
      last_verified_at: new Date().toISOString(),
    });

  return Response({
    success: true,
    message: `Вы добавлены как ${role === 'owner' ? 'владелец' : 'менеджер'} канала`,
    role,
    isNewAdmin: true,
    channel: existingChannel
  });
}
```

---

### 2. SQL миграция для существующих каналов

Создать записи в `channel_admins` для каналов, у которых есть `owner_id`:

```sql
-- Добавить владельцев существующих каналов в channel_admins
INSERT INTO public.channel_admins (channel_id, user_id, role, permissions, telegram_member_status)
SELECT 
  c.id as channel_id,
  c.owner_id as user_id,
  'owner'::channel_role as role,
  '{"can_edit_posts": true, "can_view_stats": true, "can_view_finance": true, "can_withdraw": true, "can_manage_admins": true, "can_approve_ads": true}'::jsonb as permissions,
  'creator' as telegram_member_status
FROM public.channels c
WHERE c.owner_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM public.channel_admins ca 
  WHERE ca.channel_id = c.id AND ca.user_id = c.owner_id
);
```

---

### 3. Обновление AddChannelWizard

Обработать новый ответ от API:

```typescript
if (result.success) {
  if (result.isNewAdmin) {
    // Пользователь добавлен как менеджер к существующему каналу
    toast({
      title: `Добавлены как ${result.role === 'owner' ? 'владелец' : 'менеджер'}`,
      description: "Теперь вы можете управлять этим каналом",
    });
  } else if (result.isExistingAdmin) {
    // Уже был админом
    toast({
      title: "Вы уже управляете этим каналом",
      description: `Ваша роль: ${result.role}`,
    });
  }
  
  setVerifiedChannel(result.channel);
  setStep(3);
}
```

---

### Результат

После изменений:
- Модератор `@newstutox` сможет добавить себя как менеджера
- Существующие владельцы каналов появятся в `channel_admins`
- Система корректно различает "создание канала" и "присоединение к каналу"
- UI показывает понятное сообщение о роли пользователя

