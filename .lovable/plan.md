

## Цель
Сделать так, чтобы команда канала (владелец и менеджеры) отображалась корректно — с аватаркой, именем и ролью.

## Диагностика проблем

### Проблема 1: Бесконечная рекурсия в RLS политике
Политика "Channel admins can view co-admins" на таблице `channel_admins` содержит подзапрос к той же таблице:
```sql
USING (channel_id IN (SELECT ca.channel_id FROM channel_admins ca WHERE ca.user_id = auth.uid()))
```
Postgres не может безопасно вычислить эту политику и возвращает ошибку "infinite recursion detected".

### Проблема 2: RLS на таблице `users` блокирует чтение чужих профилей
Даже если `channel_admins` был бы доступен, JOIN с `users` не вернёт данные других пользователей, так как политики на `users` разрешают видеть только свой профиль (`auth.uid() = id`).

### Проблема 3: Telegram авторизация не создаёт `auth.uid()`
Поскольку пользователи авторизуются через Telegram initData (не через Supabase Auth), `auth.uid()` всегда `null` при клиентских запросах, и RLS политики не работают как ожидается.

## Решение

### 1. Исправить RLS на `channel_admins` (убрать рекурсию)

Упростить политики, чтобы избежать рекурсии. Для чтения команды использовать backend-функцию.

**SQL миграция:**
```sql
-- Удалить проблемную политику с рекурсией
DROP POLICY IF EXISTS "Channel admins can view co-admins" ON public.channel_admins;

-- Оставить простую политику для своих записей
-- (уже существует "Users can view own admin entries")

-- Для чтения списка команды будем использовать backend-функцию
```

### 2. Создать backend-функцию `channel-team`

**Файл**: `supabase/functions/channel-team/index.ts`

- Принимает `channel_id` и `initData`
- Валидирует Telegram initData
- Проверяет, что пользователь является админом этого канала
- С помощью service role получает:
  - Все записи из `channel_admins` для этого канала
  - JOIN с `users` для получения данных профилей (имя, аватар, username)
- Возвращает массив админов с их данными

```typescript
// Пример структуры ответа
{
  success: true,
  admins: [
    {
      id: "...",
      role: "owner",
      user: {
        first_name: "Иван",
        last_name: "Иванов",
        username: "ivanov",
        photo_url: "https://..."
      }
    },
    {
      id: "...",
      role: "manager",
      user: {
        first_name: "Пётр",
        last_name: null,
        username: "petr",
        photo_url: null
      }
    }
  ]
}
```

### 3. Обновить `useChannelAdmins` хук

**Файл**: `src/hooks/useChannelAdmins.ts`

- Вместо прямого запроса к таблице через SDK
- Делать fetch к `/functions/v1/channel-team`
- Передавать `channel_id` и `initData`

```typescript
export function useChannelAdmins(channelId: string | undefined) {
  return useQuery({
    queryKey: ['channel-admins', channelId],
    queryFn: async (): Promise<ChannelAdmin[]> => {
      if (!channelId) return [];
      
      const initData = getTelegramInitData();
      if (!initData) return [];
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/channel-team`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel_id: channelId, initData }),
        }
      );
      
      const data = await response.json();
      if (!data.success) return [];
      
      return data.admins;
    },
    enabled: !!channelId,
  });
}
```

### 4. Компонент ChannelTeamCompact останется без изменений

Он уже правильно обрабатывает данные — проблема была в источнике данных.

## Результат

- RLS больше не вызывает бесконечную рекурсию
- Команда канала отображается с реальными именами и аватарками
- Менеджеры и владельцы видят друг друга в разделе "Мои каналы"
- Безопасность сохраняется — данные команды видны только админам этого канала

## Важные замечания

- Публичные пользователи (покупатели) не смогут видеть команду канала, что соответствует требованиям
- Запросы к `channel-team` защищены валидацией Telegram initData
- Функция дополнительно проверяет, что запрашивающий пользователь является админом канала

