

## План: Синхронизация избранного с БД и исправление автоудаления постов

### Проблема 1: Избранное не синхронизируется с базой данных

**Текущее поведение:**
- Пользователи добавляют каналы в избранное → данные сохраняются только в `localStorage` браузера
- На странице настроек канала отображается `favorites_count` из таблицы `favorites` в БД → **всегда 0**

**Решение:**
Синхронизировать избранное с базой данных при каждом добавлении/удалении.

### Проблема 2: Автоудаление удаляет только первый пост

**Текущее поведение:**
- При публикации нескольких постов их ID сохраняются в `telegram_message_ids` (массив)
- При автоудалении используется только `telegram_message_id` (первый пост)
- Остальные посты остаются в канале

**Решение:**
Удалять все посты из массива `telegram_message_ids`.

---

## Технические изменения

### 1. Edge Function: `toggle-favorite/index.ts` (новая)

Создать edge function для добавления/удаления из избранного:

```typescript
// POST: { channel_id, action: 'add' | 'remove' }
// Returns: { success: true, isFavorite: boolean }
```

Логика:
- Валидировать Telegram initData
- Найти user_id по telegram_id
- Если action = 'add': вставить запись в favorites (если нет)
- Если action = 'remove': удалить запись из favorites
- Вернуть текущий статус

### 2. Hook: `src/hooks/useFavorites.ts`

Переписать хук для работы с базой данных:

```typescript
export const useFavorites = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Загрузить избранное из БД при авторизации
  const { data: favorites = [] } = useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: fetchFavoritesFromDB,
    enabled: !!user,
  });
  
  // Мутация для toggle
  const toggleMutation = useMutation({
    mutationFn: toggleFavoriteInDB,
    onMutate: async (channelId) => {
      // Optimistic update
    },
  });
  
  // Fallback на localStorage для неавторизованных
  const [localFavorites, setLocalFavorites] = useState(() => 
    JSON.parse(localStorage.getItem('favoriteChannels') || '[]')
  );
  
  return {
    favorites: user ? favorites : localFavorites,
    toggleFavorite: user ? toggleMutation.mutate : toggleLocal,
    isFavorite: (id) => (user ? favorites : localFavorites).includes(id),
  };
};
```

### 3. Edge Function: `complete-posted-deals/index.ts`

Исправить автоудаление для множественных постов:

```typescript
// Строки 364-378: заменить на
let postDeleted = false;
if (channelData?.auto_delete_posts && deal.channel.telegram_chat_id) {
  console.log(`Auto-delete enabled for channel ${deal.channel_id}`);
  
  // Получить все ID постов
  const { data: dealData } = await supabase
    .from("deals")
    .select("telegram_message_ids")
    .eq("id", deal.id)
    .single();
  
  const messageIds = dealData?.telegram_message_ids as number[] || [];
  
  // Fallback на одиночный ID
  if (messageIds.length === 0 && deal.telegram_message_id) {
    messageIds.push(deal.telegram_message_id);
  }
  
  // Удалить все посты
  for (const messageId of messageIds) {
    try {
      const result = await sendTelegramRequest("deleteMessage", {
        chat_id: deal.channel.telegram_chat_id,
        message_id: messageId,
      });
      if (result.ok) postDeleted = true;
      console.log(`Deleted message ${messageId}:`, result.ok);
    } catch (err) {
      console.error(`Failed to delete message ${messageId}:`, err);
    }
  }
}
```

---

## Файлы для изменения

| Файл | Действие |
|------|----------|
| `supabase/functions/toggle-favorite/index.ts` | Создать |
| `src/hooks/useFavorites.ts` | Переписать с поддержкой БД |
| `supabase/functions/complete-posted-deals/index.ts` | Исправить удаление всех постов |

---

## Поток данных после изменений

```text
Добавление в избранное:
1. Пользователь нажимает ❤️ на карточке канала
2. → вызов toggle-favorite edge function
3. → INSERT в таблицу favorites
4. → optimistic update в UI
5. → владелец канала видит реальный счётчик в настройках

Автоудаление постов:
1. Срок рекламы истёк
2. → complete-posted-deals проверяет auto_delete_posts
3. → получает все ID из telegram_message_ids
4. → удаляет каждый пост через Telegram API
5. → уведомляет обе стороны
```

---

## Миграция существующих данных

Для синхронизации localStorage → БД можно добавить логику при первой авторизации:

```typescript
// При первом входе пользователя
const localFavorites = JSON.parse(localStorage.getItem('favoriteChannels') || '[]');
if (localFavorites.length > 0 && user) {
  // Синхронизировать с БД
  await syncLocalFavoritesToDB(user.id, localFavorites);
  localStorage.removeItem('favoriteChannels');
}
```

