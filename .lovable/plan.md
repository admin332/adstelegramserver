

## План: Безопасное обновление статуса канала через initData валидацию

### Проблема безопасности в предыдущем плане

Предыдущий план был **УЯЗВИМ**: доверял `user_id` с фронтенда. Злоумышленник мог подменить `user_id` в DevTools и управлять чужими каналами.

```text
❌ НЕБЕЗОПАСНО (предыдущий план):
┌─────────────────────────────────────────────────────────────────────┐
│  Фронтенд отправляет: { channel_id, is_active, user_id }           │
│                                              ↑                      │
│                                     Можно подменить!                │
└─────────────────────────────────────────────────────────────────────┘

✅ БЕЗОПАСНО (исправленный план):
┌─────────────────────────────────────────────────────────────────────┐
│  Фронтенд отправляет: { channel_id, is_active, initData }          │
│                                              ↑                      │
│                              Криптографическая подпись!             │
│                              Подделать невозможно!                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Архитектура безопасной валидации

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    Безопасная архитектура                           │
├─────────────────────────────────────────────────────────────────────┤
│  1. Пользователь нажимает Switch                                    │
│                              ↓                                       │
│  2. Фронтенд отправляет initData (подписанный Telegram)             │
│                              ↓                                       │
│  3. Edge Function валидирует HMAC-SHA256 подпись                    │
│                              ↓                                       │
│  4. Извлекает telegram_id из ПРОВЕРЕННЫХ данных                     │
│                              ↓                                       │
│  5. Находит user.id в БД по telegram_id                             │
│                              ↓                                       │
│  6. Проверяет channel.owner_id === user.id                          │
│                              ↓                                       │
│  7. Обновляет статус с SERVICE_ROLE_KEY                             │
│                              ↓                                       │
│  8. Toast: "Статус обновлён"                                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Файлы для создания/изменения

| Файл | Действие | Описание |
|------|----------|----------|
| `supabase/functions/update-channel-status/index.ts` | Создать | Edge function с валидацией initData |
| `supabase/config.toml` | Изменить | Добавить новую функцию |
| `src/hooks/useUserChannels.ts` | Изменить | Отправлять initData вместо user_id |

---

### Техническая реализация

**1. Edge Function `update-channel-status`**

Переиспользуем функцию `validateTelegramData` из `telegram-auth`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ... corsHeaders ...

// Копируем функцию validateTelegramData из telegram-auth
async function validateTelegramData(initData: string, botToken: string) {
  // HMAC-SHA256 валидация (такая же как в telegram-auth)
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN not configured");

    const { channel_id, is_active, initData } = await req.json();

    // 1. ВАЛИДАЦИЯ INITDATA (критично для безопасности!)
    const validation = await validateTelegramData(initData, botToken);
    if (!validation.valid || !validation.data?.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid Telegram data" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const telegramId = validation.data.user.id; // Этому ID можно доверять!

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 2. Находим пользователя по telegram_id
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("telegram_id", telegramId)
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        { status: 404, headers: corsHeaders }
      );
    }

    // 3. Проверяем владение каналом
    const { data: channel, error: channelError } = await supabaseAdmin
      .from("channels")
      .select("owner_id")
      .eq("id", channel_id)
      .single();

    if (channelError || !channel) {
      return new Response(
        JSON.stringify({ success: false, error: "Channel not found" }),
        { status: 404, headers: corsHeaders }
      );
    }

    if (channel.owner_id !== user.id) {
      return new Response(
        JSON.stringify({ success: false, error: "Access denied" }),
        { status: 403, headers: corsHeaders }
      );
    }

    // 4. Обновляем статус (SERVICE_ROLE обходит RLS)
    const { error: updateError } = await supabaseAdmin
      .from("channels")
      .update({ is_active })
      .eq("id", channel_id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true }),
      { headers: corsHeaders }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
```

---

**2. Обновление хука `useToggleChannelActive`**

```typescript
import { getTelegramInitData } from "@/lib/telegram";

export function useToggleChannelActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ channelId, isActive }: { channelId: string; isActive: boolean }) => {
      const initData = getTelegramInitData();
      
      if (!initData) {
        throw new Error("Telegram data not available");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-channel-status`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            channel_id: channelId,
            is_active: isActive,
            initData, // Отправляем подписанные данные, а не user_id!
          }),
        }
      );

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to update channel");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-channels"] });
      toast({
        title: "Статус обновлён",
        description: "Изменения сохранены",
      });
    },
    onError: (error) => {
      console.error("Toggle channel error:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось обновить статус канала",
        variant: "destructive",
      });
    },
  });
}
```

---

### Сравнение безопасности

| Аспект | Предыдущий план ❌ | Исправленный план ✅ |
|--------|-------------------|----------------------|
| Источник идентификации | `user_id` из body | `telegram_id` из initData |
| Можно подделать? | Да, через DevTools | Нет, HMAC-SHA256 |
| Валидация | Никакой | Криптографическая |
| Проверка владельца | `owner_id === user_id` (ненадёжно) | `owner_id === user.id` (надёжно) |

---

### Цепочка доверия

```text
┌─────────────────────────────────────────────────────────────────────┐
│  1. Telegram подписывает initData ключом бота                       │
│                              ↓                                       │
│  2. Edge Function проверяет подпись (HMAC-SHA256)                   │
│                              ↓                                       │
│  3. Если хеш совпал → telegram_id подлинный                         │
│                              ↓                                       │
│  4. По telegram_id находим UUID пользователя в БД                   │
│                              ↓                                       │
│  5. Сравниваем owner_id канала с UUID пользователя                  │
│                              ↓                                       │
│  6. Только владелец может изменить статус ✅                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Секреты (уже настроены)

Необходимый секрет `TELEGRAM_BOT_TOKEN` уже добавлен в проект — дополнительных действий не требуется.

---

### Результат

После изменений:
- Telegram пользователи смогут переключать статус каналов ✅
- Невозможно управлять чужими каналами ✅
- Криптографическая валидация на бэкенде ✅
- Соответствует лучшим практикам безопасности ✅

