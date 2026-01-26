

## План: Исправить валидацию category для существующих каналов

### Проблема

В Edge Function `verify-channel` на строках 236-241 проверка `!category` выполняется **до** проверки существующего канала:

```typescript
// Текущий код (строки 236-241)
if (!username || !category) {
  return new Response(
    JSON.stringify({ success: false, error: "Не все обязательные поля заполнены" }),
    ...
  );
}
```

Это блокирует менеджеров, которые добавляют **существующий** канал, хотя им категория не нужна.

### Анализ безопасности (✅ Подтверждено)

Проверка Telegram ID реализована **безопасно**:
- `initData` валидируется через HMAC-SHA256 (строки 21-88)
- `telegramId` извлекается из **валидированных** данных (строка 233)
- Проверка прав в Telegram использует верифицированный `telegramId` (строка 293)
- Frontend не может подделать ID пользователя

### Решение

Изменить порядок проверок в `verify-channel`:
1. Сначала проверить существование канала
2. Требовать `category` только для **новых** каналов

### Изменения

| Файл | Действие |
|------|----------|
| `supabase/functions/verify-channel/index.ts` | Изменить порядок валидации |

### Код изменений

**Было (строки 236-241):**
```typescript
if (!username || !category) {
  return new Response(
    JSON.stringify({ success: false, error: "Не все обязательные поля заполнены" }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

**Станет:**
```typescript
// Username всегда обязателен
if (!username) {
  return new Response(
    JSON.stringify({ success: false, error: "Не указан username канала" }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ... (далее код получения канала, проверка бота)

// После получения existingChannel:
// Для существующих каналов category не нужна
// Для новых каналов category обязательна — проверить перед INSERT
```

Конкретно нужно:
1. Убрать проверку `!category` на строке 236
2. Добавить проверку `category` только перед вставкой нового канала (перед строкой 421)

```typescript
// Перед строкой 421 (INSERT новго канала):
if (!category) {
  return new Response(
    JSON.stringify({ success: false, error: "Выберите категорию для нового канала" }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

### Результат

| Сценарий | Категория | Результат |
|----------|-----------|-----------|
| Новый канал без категории | Требуется | Ошибка "Выберите категорию" |
| Существующий канал (менеджер) | Не требуется | Успех — добавлен как менеджер |

