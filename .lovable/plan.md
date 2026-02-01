
## План: Отображение роли (владелец/менеджер) в сделках

### Текущее поведение

| Аспект | Сейчас | Проблема |
|--------|--------|----------|
| **API** | Возвращает только `role: "channel_owner"` или `"advertiser"` | Не различает владельца и менеджера |
| **UI** | Показывает метку "входящий" для всех владельцев каналов | Менеджер не видит свою роль |

### Новое поведение

- **API**: Возвращает дополнительное поле `channel_role: "owner" | "manager" | null`
- **UI**: Показывает разные метки:
  - Владелец: **"входящий"** (синий)
  - Менеджер: **"менеджер"** (зелёный)

---

## Техническая реализация

### 1. Обновление API `user-deals/index.ts`

Добавить получение роли из `channel_admins`:

```typescript
// Get channel admin info with roles
const { data: channelAdmins } = await supabase
  .from("channel_admins")
  .select("channel_id, role")  // ← Добавить role
  .eq("user_id", userId);

// Create map: channel_id -> role
const channelRoleMap = new Map(
  channelAdmins?.map(ca => [ca.channel_id, ca.role]) || []
);

// In transform:
return {
  ...
  role,
  channel_role: role === 'channel_owner' 
    ? channelRoleMap.get(deal.channel_id) || null 
    : null,
  ...
}
```

### 2. Обновление интерфейса `useUserDeals.ts`

```typescript
export interface Deal {
  // ... existing fields
  role: 'advertiser' | 'channel_owner';
  channel_role: 'owner' | 'manager' | null;  // ← Новое поле
}
```

### 3. Обновление компонента `DealCard.tsx`

Добавить пропс и обновить метку:

```typescript
interface DealCardProps {
  // ... existing props
  channelRole: 'owner' | 'manager' | null;
}

// В JSX:
{isChannelOwner && (
  <span className={cn(
    "text-xs px-1.5 py-0.5 rounded",
    channelRole === 'manager' 
      ? "bg-green-500/10 text-green-500" 
      : "bg-secondary text-muted-foreground"
  )}>
    {channelRole === 'manager' ? 'менеджер' : 'входящий'}
  </span>
)}
```

### 4. Обновление `Deals.tsx`

```tsx
<DealCard 
  ...
  channelRole={deal.channel_role}
  ...
/>
```

---

## Итоговый UX

| Роль | Метка | Цвет |
|------|-------|------|
| Рекламодатель | — | — |
| Владелец канала | "входящий" | Серый |
| Менеджер канала | "менеджер" | Зелёный |

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `supabase/functions/user-deals/index.ts` | Добавить `channel_role` из `channel_admins.role` |
| `src/hooks/useUserDeals.ts` | Добавить тип `channel_role` |
| `src/components/DealCard.tsx` | Показывать метку "менеджер" вместо "входящий" |
| `src/pages/Deals.tsx` | Передать новый пропс |
