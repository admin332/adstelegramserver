# Completed

## ✅ Исправление: Сохранение состояния запроса на доработку в базе данных

**Проблема:** Состояние "ожидание комментария для доработки" хранилось в памяти Edge Function, но Supabase Edge Functions stateless — каждый запрос может обрабатываться разным экземпляром.

**Решение:** Перенесли состояние в таблицу `telegram_user_states`.

### Выполненные изменения:

1. ✅ Создана таблица `telegram_user_states`:
   - `telegram_user_id` (UNIQUE) 
   - `state_type` (например 'awaiting_revision')
   - `deal_id` (связь с deals, ON DELETE CASCADE)
   - `draft_index` (индекс черновика)
   - `expires_at` (автоматическое истечение через 1 час)

2. ✅ Обновлён `supabase/functions/telegram-webhook/index.ts`:
   - Удалён in-memory `userStates: Map`
   - Добавлены функции `setUserState()`, `getUserState()`, `clearUserState()`
   - `handleDraftRevision()` — сохраняет состояние в БД
   - `handleRevisionComment()` — читает состояние из БД
   - `handleCancelRevision()` — восстанавливает кнопки "Одобрить"/"На доработку"
   - Main handler — использует `await getUserState()`

### Итоговый поток:

```
1. Рекламодатель нажимает "На доработку"
   → Состояние сохраняется в БД
   
2. Рекламодатель пишет комментарий  
   → Любой инстанс Edge Function читает состояние из БД
   → Обрабатывает комментарий
   → Удаляет состояние
   
3. Если рекламодатель нажимает "Отмена"
   → Удаляет состояние из БД
   → Показывает кнопки "Одобрить" / "На доработку" снова
```
