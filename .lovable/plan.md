

## План: Система ролей администраторов каналов (channel_admins)

### Цель
Реализовать разделение прав доступа к каналам: **владелец** (получает деньги) и **менеджер** (редактирует посты). С перепроверкой прав через Telegram API при критических операциях.

---

### Архитектура системы

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    Связь с Telegram API                            │
├─────────────────────────────────────────────────────────────────────┤
│  Первый админ добавляет канал → OWNER                               │
│                              ↓                                       │
│  Другой админ канала заходит в Adsingo                              │
│                              ↓                                       │
│  getChatMember → administrator? → MANAGER                           │
│                              ↓                                       │
│  Критическая операция (финансы/постинг)                             │
│                              ↓                                       │
│  RE-CHECK: getChatMember → всё ещё админ?                           │
│                              ↓                                       │
│  Да → разрешить | Нет → удалить из channel_admins + заблокировать   │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 1. Миграция базы данных

**Создать ENUM для ролей:**
```sql
CREATE TYPE public.channel_role AS ENUM ('owner', 'manager');
```

**Создать таблицу channel_admins:**
```sql
CREATE TABLE public.channel_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  role channel_role NOT NULL DEFAULT 'manager',
  permissions JSONB DEFAULT '{"can_edit_posts": true, "can_view_stats": true, "can_view_finance": false, "can_withdraw": false}'::jsonb,
  telegram_member_status TEXT, -- creator/administrator
  last_verified_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (channel_id, user_id)
);
```

**RLS политики:**
```sql
ALTER TABLE public.channel_admins ENABLE ROW LEVEL SECURITY;

-- Чтение: только участники канала
CREATE POLICY "Channel admins can view own channel admins"
ON public.channel_admins FOR SELECT
USING (user_id = auth.uid() OR channel_id IN (
  SELECT channel_id FROM channel_admins WHERE user_id = auth.uid()
));

-- Service role для Edge Functions
CREATE POLICY "Service role can manage channel admins"
ON public.channel_admins FOR ALL
USING (true) WITH CHECK (true);
```

---

### 2. Права по ролям

| Право | Owner | Manager |
|-------|-------|---------|
| `can_edit_posts` | true | true |
| `can_view_stats` | true | true |
| `can_approve_ads` | true | true |
| `can_view_finance` | true | **false** |
| `can_withdraw` | true | **false** |
| `can_manage_admins` | true | **false** |

---

### 3. Изменение verify-channel (первичная привязка)

При добавлении канала — автоматически создавать запись в `channel_admins`:

```typescript
// После успешного INSERT в channels
const memberStatus = userMember?.status; // 'creator' или 'administrator'

await supabase.from("channel_admins").insert({
  channel_id: newChannel.id,
  user_id: userData.id,
  role: memberStatus === 'creator' ? 'owner' : 'manager',
  telegram_member_status: memberStatus,
  permissions: memberStatus === 'creator' 
    ? { can_edit_posts: true, can_view_stats: true, can_view_finance: true, can_withdraw: true, can_manage_admins: true }
    : { can_edit_posts: true, can_view_stats: true, can_view_finance: false, can_withdraw: false, can_manage_admins: false },
  last_verified_at: new Date().toISOString(),
});
```

---

### 4. Новая Edge Function: join-channel-as-admin

Когда **другой пользователь** пытается получить доступ к каналу:

```typescript
// POST /functions/v1/join-channel-as-admin
// Body: { channel_id, initData }

// 1. Валидация initData → telegramId
// 2. Найти channel.telegram_chat_id
// 3. getChatMember(telegram_chat_id, telegramId)
// 4. Если administrator → добавить в channel_admins с role='manager'
// 5. Если creator → role='owner' (но owner обычно уже есть)
// 6. Если не админ в TG → отказать
```

---

### 5. Функция перепроверки (recheck-admin-status)

**Вызывается перед критическими операциями:**

```typescript
async function recheckAdminStatus(
  supabase: SupabaseClient,
  botToken: string,
  channelId: string,
  userId: string
): Promise<{ valid: boolean; error?: string }> {
  
  // 1. Получить channel и channel_admin
  const { data: admin } = await supabase
    .from("channel_admins")
    .select("*, channels(telegram_chat_id)")
    .eq("channel_id", channelId)
    .eq("user_id", userId)
    .single();

  if (!admin) {
    return { valid: false, error: "Нет доступа к каналу" };
  }

  // 2. Получить telegram_id пользователя
  const { data: user } = await supabase
    .from("users")
    .select("telegram_id")
    .eq("id", userId)
    .single();

  // 3. Проверить в Telegram API
  const tgMember = await getChatMember(
    botToken, 
    admin.channels.telegram_chat_id, 
    user.telegram_id
  );

  const stillAdmin = tgMember && 
    ['creator', 'administrator'].includes(tgMember.status);

  if (!stillAdmin) {
    // 4. Удалить из channel_admins
    await supabase
      .from("channel_admins")
      .delete()
      .eq("id", admin.id);

    return { valid: false, error: "Ваши права администратора в Telegram были отозваны" };
  }

  // 5. Обновить last_verified_at
  await supabase
    .from("channel_admins")
    .update({ 
      last_verified_at: new Date().toISOString(),
      telegram_member_status: tgMember.status 
    })
    .eq("id", admin.id);

  return { valid: true };
}
```

---

### 6. Обновление update-channel-status

Теперь проверяем через `channel_admins`:

```typescript
// Вместо:
if (channel.owner_id !== user.id) { ... }

// Новая логика:
const { data: adminRecord } = await supabase
  .from("channel_admins")
  .select("role, permissions")
  .eq("channel_id", channel_id)
  .eq("user_id", user.id)
  .single();

if (!adminRecord) {
  return { error: "Нет доступа к каналу" };
}

// Для переключения статуса достаточно любой роли
// Но для финансов — проверяем permissions.can_withdraw
```

---

### 7. UI: Отображение команды канала

В `/channel/:id` для владельца показать список администраторов:

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Команда канала                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  👤 @ivanov          Owner           Полный доступ                  │
│  👤 @petrov          Manager         Редактирование постов          │
│  👤 @sidorov         Manager         Редактирование постов          │
│                                                                     │
│  [+ Пригласить администратора]                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 8. Файлы для создания/изменения

| Файл | Действие | Описание |
|------|----------|----------|
| **Миграция** | Создать | channel_admins таблица + ENUM |
| `supabase/functions/verify-channel/index.ts` | Изменить | Создавать запись в channel_admins |
| `supabase/functions/join-channel-as-admin/index.ts` | Создать | Присоединение менеджера к каналу |
| `supabase/functions/update-channel-status/index.ts` | Изменить | Проверять через channel_admins |
| `src/hooks/useChannelAdmins.ts` | Создать | Хук для списка администраторов |
| `src/components/channel/ChannelTeam.tsx` | Создать | UI списка администраторов |

---

### Результат для жюри

После реализации:
- База данных понимает разницу между **владельцем** и **менеджером**
- Права синхронизированы с реальными правами в Telegram
- **Перепроверка** при критических операциях (финансы, постинг)
- Автоматическое удаление доступа при отзыве прав в Telegram
- Разделение прав: менеджер НЕ может выводить деньги

