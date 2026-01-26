

## План: Отображение каналов для менеджеров

### Проблема

Менеджер добавил канал `@newstutox`, запись появилась в `channel_admins` с `role: manager`, но канал не отображается в списке "Мои каналы".

**Причины:**
1. `useUserChannels` запрашивает каналы только по `owner_id` — менеджеры не учитываются
2. RLS политика для `channel_admins` разрешает доступ только `service_role`, обычные пользователи не могут читать свои записи

### Данные в БД

```text
channel_admins:
- channel_id: 268a9c10... (newstutox)
- user_id: de778487... (менеджер)
- role: manager ✓

channels:
- id: 268a9c10...
- owner_id: 3843ec7b... (владелец, не менеджер)
```

---

### Решения

| Файл/Таблица | Действие | Описание |
|--------------|----------|----------|
| **SQL миграция** | Добавить RLS | Пользователи могут читать свои записи в `channel_admins` |
| `src/hooks/useUserChannels.ts` | Изменить запрос | Получать каналы через `channel_admins`, а не только `owner_id` |
| `src/components/create/MyChannelsList.tsx` | Добавить бейдж роли | Показывать "Владелец" или "Менеджер" для каждого канала |

---

### 1. SQL миграция — RLS для channel_admins

```sql
-- Политика: пользователи могут читать свои записи в channel_admins
CREATE POLICY "Users can view own admin entries"
  ON public.channel_admins
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Политика: пользователи могут читать админов каналов, где сами админы
CREATE POLICY "Channel admins can view co-admins"
  ON public.channel_admins
  FOR SELECT
  TO authenticated
  USING (
    channel_id IN (
      SELECT ca.channel_id 
      FROM public.channel_admins ca 
      WHERE ca.user_id = auth.uid()
    )
  );
```

---

### 2. Обновление useUserChannels.ts

**Текущий запрос:**
```typescript
.from("channels")
.select("*")
.eq("owner_id", user.id)
```

**Новый запрос через channel_admins:**
```typescript
// Сначала получить channel_ids из channel_admins
const { data: adminEntries } = await supabase
  .from("channel_admins")
  .select("channel_id, role")
  .eq("user_id", user.id);

if (!adminEntries || adminEntries.length === 0) return [];

const channelIds = adminEntries.map(e => e.channel_id);

// Затем получить каналы
const { data: channels } = await supabase
  .from("channels")
  .select("*")
  .in("id", channelIds)
  .order("created_at", { ascending: false });

// Добавить роль к каждому каналу
return channels.map(ch => ({
  ...ch,
  userRole: adminEntries.find(e => e.channel_id === ch.id)?.role
}));
```

---

### 3. Обновление интерфейса UserChannel

```typescript
export interface UserChannel {
  // ... существующие поля
  userRole?: 'owner' | 'manager';
}
```

---

### 4. Отображение роли в MyChannelsList

Добавить бейдж роли рядом с названием канала:

```typescript
<div className="flex items-center gap-2">
  <h3 className="font-semibold text-foreground truncate">
    {channel.title || channel.username}
  </h3>
  {channel.verified && (
    <BadgeCheck className="w-4 h-4 text-primary flex-shrink-0" />
  )}
  {channel.userRole === 'manager' && (
    <Badge variant="secondary" className="text-xs">
      Менеджер
    </Badge>
  )}
</div>
```

---

### Результат

| Пользователь | Видит каналы | Бейдж |
|--------------|--------------|-------|
| Владелец | Свои каналы | — |
| Менеджер | Каналы из `channel_admins` | "Менеджер" |

