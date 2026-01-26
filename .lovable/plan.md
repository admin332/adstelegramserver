

## План: Исправление удаления кампаний и переименование страницы

### Проблема 1: Заголовок страницы

Текущий заголовок "Мои кампании" нужно изменить на "Кампании".

**Файл:** `src/components/create/MyCampaignsList.tsx` (строка 56)

```tsx
// Было:
<h2 className="text-lg font-semibold text-foreground">Мои кампании</h2>

// Станет:
<h2 className="text-lg font-semibold text-foreground">Кампании</h2>
```

---

### Проблема 2: Удаление кампании не работает

**Причина:**  
Приложение использует Telegram-аутентификацию. При этом:
- Создание кампании работает через edge function с service role (обходит RLS)
- Удаление пытается работать напрямую через клиент
- RLS политика проверяет `owner_id = auth.uid()`, но `auth.uid()` = `null` (пользователь не залогинен в Supabase Auth)
- Результат: удаление тихо игнорируется, toast показывается, но строка остаётся в базе

**Решение:** Создать edge function для удаления кампаний

---

### Новая edge function: `delete-campaign`

```text
supabase/functions/delete-campaign/index.ts
```

Логика:
1. Принимает `campaign_id` и `user_id`
2. Проверяет, что кампания принадлежит пользователю (`owner_id = user_id`)
3. Удаляет кампанию через service role key
4. Возвращает успех или ошибку

---

### Изменения в хуке `useDeleteCampaign`

**Файл:** `src/hooks/useUserCampaigns.ts`

Вместо прямого вызова:
```typescript
await supabase.from("campaigns").delete().eq("id", campaignId);
```

Будет вызов edge function:
```typescript
await supabase.functions.invoke("delete-campaign", {
  body: { campaign_id: campaignId, user_id: user.id }
});
```

---

### Файлы для изменения

| Файл | Действие |
|------|----------|
| `src/components/create/MyCampaignsList.tsx` | Изменить заголовок на "Кампании" |
| `src/hooks/useUserCampaigns.ts` | Переделать `useDeleteCampaign` на вызов edge function |
| `supabase/functions/delete-campaign/index.ts` | Создать — edge function для безопасного удаления |

---

### Архитектура решения

```text
┌─────────────────────┐
│   Клиент (React)    │
│                     │
│  useDeleteCampaign  │
└──────────┬──────────┘
           │ invoke("delete-campaign")
           ▼
┌─────────────────────┐
│   Edge Function     │
│  delete-campaign    │
│                     │
│  1. Проверка user   │
│  2. Проверка owner  │
│  3. DELETE запрос   │
│    (service role)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│     Supabase DB     │
│                     │
│  campaigns table    │
│  (RLS bypassed)     │
└─────────────────────┘
```

---

### Результат

- Заголовок станет "Кампании" вместо "Мои кампании"
- Удаление кампании будет работать корректно
- Кампания исчезнет из списка после удаления
- Безопасность сохраняется: только владелец может удалить свою кампанию

