
## План: Исправить видимость деактивированных каналов для админов

### Диагноз

Канал `@newstutox` **НЕ удалён**, он существует в базе с `is_active: false`. Проблема в RLS политике таблицы `channels`:

```sql
-- Текущая политика
USING ((owner_id = auth.uid()) OR ((is_active = true) AND (verified = true)))
```

Эта политика НЕ учитывает менеджеров из `channel_admins`. Когда канал деактивирован, менеджер не видит его потому что:
- Он не `owner_id`
- `is_active = false`

---

### Решение

Обновить RLS политику `View channels` для учёта записей в `channel_admins`.

---

### SQL миграция

```sql
-- Удалить старую политику
DROP POLICY IF EXISTS "View channels" ON public.channels;

-- Создать новую политику с учётом channel_admins
CREATE POLICY "View channels" ON public.channels
FOR SELECT
TO authenticated
USING (
  -- Владелец видит все свои каналы
  owner_id = auth.uid()
  OR
  -- Админы/менеджеры видят каналы, к которым имеют доступ
  id IN (
    SELECT channel_id FROM public.channel_admins WHERE user_id = auth.uid()
  )
  OR
  -- Публичные активные верифицированные каналы
  (is_active = true AND verified = true)
);
```

---

### Результат

| Пользователь | is_active | Видит канал |
|--------------|-----------|-------------|
| Владелец | true/false | Да (всегда) |
| Менеджер | true/false | Да (всегда) |
| Обычный пользователь | true | Да |
| Обычный пользователь | false | Нет |

### Публичный каталог

Каналы с `is_active = false`:
- Не отображаются в публичном каталоге (`/channels`)
- Не доступны для заказа рекламы
- Видны только владельцу и менеджерам для управления
