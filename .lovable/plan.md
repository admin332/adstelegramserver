

# Исправление: каналы не загружаются + ошибки сборки

## Проблема
1. Функция `user-channels` не задеплоена на сервере — при нажатии "добавить канал" запрос возвращает 404, и список каналов пуст.
2. Функции `verify-channel` и `refresh-channel-stats` не могут задеплоиться из-за ошибки TypeScript в функции `cacheChannelAvatar` — несовместимый тип `SupabaseClient`.

## Причина
Это не атака. Функции просто не были задеплоены (или были потеряны при последнем деплое). Ошибка типизации блокирует сборку двух функций.

## Исправления

### 1. Исправить тип SupabaseClient в cacheChannelAvatar
В обоих файлах (`verify-channel/index.ts` и `refresh-channel-stats/index.ts`) заменить строгий тип параметра `supabaseAdmin` на `any`:

```typescript
// Было:
async function cacheChannelAvatar(
  supabaseAdmin: SupabaseClient,
  ...
)

// Станет:
async function cacheChannelAvatar(
  supabaseAdmin: any,
  ...
)
```

### 2. Задеплоить все три функции
После исправления типов задеплоить:
- `user-channels` (основная проблема — список каналов)
- `verify-channel`
- `refresh-channel-stats`

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `supabase/functions/verify-channel/index.ts` | Тип параметра `supabaseAdmin` -> `any` |
| `supabase/functions/refresh-channel-stats/index.ts` | Тип параметра `supabaseAdmin` -> `any` |

## Результат
- Список каналов снова загружается при нажатии "добавить канал"
- Все три Edge Functions успешно деплоятся без ошибок TypeScript

