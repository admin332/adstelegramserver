
## План: Исправить загрузку медиафайлов для Telegram пользователей

### Обнаруженная проблема

**Корневая причина**: Storage RLS политика требует роль `authenticated`, но Telegram авторизация НЕ создаёт Supabase сессию. Поэтому `auth.uid()` всегда `null` и загрузка файлов блокируется RLS.

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    Текущая ситуация                                 │
├─────────────────────────────────────────────────────────────────────┤
│  1. Пользователь выбирает фото/видео                                │
│                              ↓                                       │
│  2. Фронтенд вызывает supabase.storage.upload()                     │
│                              ↓                                       │
│  3. RLS проверяет: roles = {authenticated}                          │
│                              ↓                                       │
│  4. У Telegram-пользователя НЕТ Supabase сессии                     │
│                              ↓                                       │
│  5. Загрузка ОТКЛОНЯЕТСЯ → media_urls = []                          │
│                              ↓                                       │
│  6. Edge function получает пустой массив                            │
│                              ↓                                       │
│  7. Отправляется только текст (sendMessage)                         │
└─────────────────────────────────────────────────────────────────────┘
```

### Решение

Создать Edge Function `upload-campaign-media` которая:
- Принимает файл напрямую
- Использует service role key для загрузки (обходит RLS)
- Возвращает публичный URL

| Файл | Действие | Описание |
|------|----------|----------|
| `supabase/functions/upload-campaign-media/index.ts` | Создать | Edge function для загрузки с service role |
| `src/components/create/CreateCampaignForm.tsx` | Изменить | Использовать edge function вместо прямого upload |
| `supabase/config.toml` | Изменить | Добавить конфигурацию новой функции |

---

### Техническая реализация

**1. Edge Function `upload-campaign-media`**

```typescript
// Принимает multipart/form-data с файлом
// Загружает в Storage используя service role
// Возвращает публичный URL

interface UploadResponse {
  success: boolean;
  url?: string;
  error?: string;
}

// Ключевой момент: используем SUPABASE_SERVICE_ROLE_KEY
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Загрузка обходит RLS
const { error } = await supabaseAdmin.storage
  .from('campaign-images')
  .upload(fileName, fileBuffer, { contentType });
```

**2. Обновление фронтенда**

```typescript
// Вместо прямого upload
// Было:
const { error } = await supabase.storage
  .from("campaign-images")
  .upload(fileName, file);

// Станет:
const formData = new FormData();
formData.append('file', file);
formData.append('user_id', user.id);

const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-campaign-media`,
  {
    method: 'POST',
    headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
    body: formData
  }
);

const { url } = await response.json();
mediaUrls.push(url);
```

---

### Архитектура после исправления

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    Новая архитектура                                │
├─────────────────────────────────────────────────────────────────────┤
│  1. Пользователь выбирает фото/видео                                │
│                              ↓                                       │
│  2. Фронтенд отправляет файл в Edge Function                        │
│                              ↓                                       │
│  3. Edge Function использует SERVICE_ROLE_KEY                       │
│                              ↓                                       │
│  4. Загрузка УСПЕШНА (обходит RLS)                                  │
│                              ↓                                       │
│  5. Возвращается публичный URL                                      │
│                              ↓                                       │
│  6. media_urls = [url1, url2, ...]                                  │
│                              ↓                                       │
│  7. send-campaign-preview получает URLs                             │
│                              ↓                                       │
│  8. Telegram Bot отправляет sendPhoto/sendVideo                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Дополнительные улучшения

1. **Исправить ошибку Telegram SDK** в `initTelegramApp()`:
   - Обернуть `requestFullscreen()` в try-catch (уже видно в логах ошибку `WebAppMethodUnsupported`)

2. **Добавить валидацию файлов** в edge function:
   - Проверка типа файла (image/*, video/*)
   - Проверка размера (до 50 МБ)

3. **Показывать прогресс загрузки** каждого файла в UI

---

### Результат после изменений

Пользователь создаёт кампанию с медиа:
1. Файлы загружаются через Edge Function ✅
2. Получаем массив публичных URLs ✅
3. Edge function send-campaign-preview получает URLs
4. Telegram Bot отправляет фото/видео с caption ✅
5. Пользователь видит полноценное превью в личке

```text
┌─────────────────────────────────┐
│  [Фото или видео]               │  ← Теперь отображается!
├─────────────────────────────────┤
│  Рекламаааааа тестовая          │
│                                 │
│  [Купить]                       │
└─────────────────────────────────┘
```
