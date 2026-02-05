
# План: Кэширование аватарок каналов в Storage

## Проблема
Telegram выдаёт временные ссылки на аватарки каналов через Bot API. Эти ссылки истекают через некоторое время, и пользователь видит пустое место вместо аватарки.

## Решение
Скачивать аватарки из Telegram и сохранять их в файловое хранилище. В базе хранить стабильную публичную ссылку. Если обновление не удалось — сохранять старую аватарку.

---

## Архитектура

```text
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Telegram      │     │   Edge Function │     │   Storage       │
│   Bot API       │────▶│   (verify/      │────▶│   channel-      │
│   (temp URL)    │     │    refresh)     │     │   avatars       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                │                        │
                                ▼                        ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │   PostgreSQL    │◀────│   Public URL    │
                        │   avatar_url    │     │   (stable)      │
                        └─────────────────┘     └─────────────────┘
```

---

## Изменения

### 1. Создать bucket для аватарок
**Новая миграция SQL:**
```sql
-- Создать bucket для аватарок каналов
INSERT INTO storage.buckets (id, name, public)
VALUES ('channel-avatars', 'channel-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: разрешить публичное чтение
CREATE POLICY "Public can view channel avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'channel-avatars');

-- RLS: разрешить service role загружать/удалять
CREATE POLICY "Service role can manage channel avatars"
ON storage.objects FOR ALL
USING (bucket_id = 'channel-avatars');
```

### 2. Модифицировать verify-channel/index.ts
**Логика:**
1. Получить `big_file_id` через `getChat`
2. Получить временную ссылку через `getFile`
3. Скачать изображение (fetch)
4. Загрузить в bucket `channel-avatars` как `{channel_id}.jpg`
5. Сохранить публичную ссылку в `avatar_url`

**Код (добавить функцию):**
```typescript
async function cacheChannelAvatar(
  supabaseAdmin: SupabaseClient,
  botToken: string,
  channelId: string,
  photoFileId: string | undefined,
  existingAvatarUrl: string | null
): Promise<string | null> {
  // Если нет фото — оставляем старую ссылку
  if (!photoFileId) {
    return existingAvatarUrl;
  }

  try {
    // 1. Получить временную ссылку из Telegram
    const fileUrl = await getFileUrl(botToken, photoFileId);
    if (!fileUrl) {
      console.log("[avatar] Could not get file URL, keeping existing");
      return existingAvatarUrl;
    }

    // 2. Скачать изображение
    const response = await fetch(fileUrl);
    if (!response.ok) {
      console.log("[avatar] Failed to download, keeping existing");
      return existingAvatarUrl;
    }
    const arrayBuffer = await response.arrayBuffer();

    // 3. Загрузить в storage (перезаписать если существует)
    const fileName = `${channelId}.jpg`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("channel-avatars")
      .upload(fileName, arrayBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("[avatar] Upload error:", uploadError);
      return existingAvatarUrl;
    }

    // 4. Получить публичную ссылку
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from("channel-avatars")
      .getPublicUrl(fileName);

    console.log(`[avatar] Cached avatar for channel ${channelId}`);
    return publicUrl;
  } catch (error) {
    console.error("[avatar] Error caching avatar:", error);
    return existingAvatarUrl;
  }
}
```

### 3. Модифицировать refresh-channel-stats/index.ts
**Аналогичная логика:**
- При обновлении статистики также обновлять аватарку
- Если скачивание не удалось — `avatar_url` не меняется (старая ссылка)

### 4. Убрать fallback с буквами на фронтенде
После этих изменений `avatar_url` всегда будет валидной ссылкой из нашего storage, и fallback на ui-avatars не потребуется.

Можно оставить его как последний fallback на случай если storage недоступен.

---

## Файлы для изменения

| Файл | Действие |
|------|----------|
| `supabase/migrations/xxx_channel_avatars_bucket.sql` | Новый: создание bucket + RLS |
| `supabase/functions/verify-channel/index.ts` | Добавить cacheChannelAvatar() |
| `supabase/functions/refresh-channel-stats/index.ts` | Добавить cacheChannelAvatar() |

---

## Результат
- Аватарки хранятся в нашем storage со стабильными ссылками
- Если Telegram недоступен или фото не обновилось — показывается старая аватарка
- Пользователь никогда не видит пустоту или буквы вместо реального фото
- Ссылки формата: `https://{project}.supabase.co/storage/v1/object/public/channel-avatars/{channel_id}.jpg`
