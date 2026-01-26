

## План: Исправление уязвимостей безопасности во всех Edge Functions

### Обнаруженные уязвимости

Проверка выявила **4 критических уязвимости** — все связаны с тем, что `user_id` или `telegram_user_id` принимаются с фронтенда без проверки подлинности.

| Функция | Уровень риска | Проблема |
|---------|---------------|----------|
| `create-campaign` | КРИТИЧЕСКИЙ | Доверяет `user_id` из body — можно создать кампанию от имени другого пользователя |
| `upload-campaign-media` | КРИТИЧЕСКИЙ | Доверяет `user_id` из formData — можно загрузить файлы в папку другого пользователя |
| `delete-campaign` | КРИТИЧЕСКИЙ | Доверяет `user_id` из body — можно удалить чужую кампанию |
| `verify-channel` | КРИТИЧЕСКИЙ | Доверяет `telegram_user_id` из body — можно добавить канал от имени другого пользователя |
| `update-channel-status` | БЕЗОПАСНО | Уже использует initData валидацию |
| `send-campaign-preview` | НИЗКИЙ | Отправляет сообщение по telegram_id, но это не критично (спам-риск) |
| `telegram-auth` | БЕЗОПАСНО | Правильно валидирует initData |

---

### Архитектура уязвимости

```text
ТЕКУЩАЯ НЕБЕЗОПАСНАЯ СХЕМА (4 функции):
┌─────────────────────────────────────────────────────────────────────┐
│  Фронтенд отправляет: { user_id: "abc123", ... }                   │
│                              ↓                                       │
│  Edge Function доверяет этому user_id                               │
│                              ↓                                       │
│  Злоумышленник может подменить user_id в DevTools                   │
│                              ↓                                       │
│  Создаёт/удаляет контент от имени жертвы                            │
└─────────────────────────────────────────────────────────────────────┘

БЕЗОПАСНАЯ СХЕМА (как в update-channel-status):
┌─────────────────────────────────────────────────────────────────────┐
│  Фронтенд отправляет: { initData: "подписанные_данные", ... }       │
│                              ↓                                       │
│  Edge Function валидирует HMAC-SHA256 подпись                       │
│                              ↓                                       │
│  Извлекает telegram_id → находит user.id в БД                       │
│                              ↓                                       │
│  Использует ПРОВЕРЕННЫЙ user.id для операций                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Файлы для изменения

| Файл | Действие | Описание |
|------|----------|----------|
| `supabase/functions/create-campaign/index.ts` | Изменить | Добавить initData валидацию |
| `supabase/functions/upload-campaign-media/index.ts` | Изменить | Добавить initData валидацию |
| `supabase/functions/delete-campaign/index.ts` | Изменить | Добавить initData валидацию |
| `supabase/functions/verify-channel/index.ts` | Изменить | Добавить initData валидацию |
| `src/components/create/CreateCampaignForm.tsx` | Изменить | Отправлять initData вместо user_id |
| `src/hooks/useUserCampaigns.ts` | Изменить | Отправлять initData в delete-campaign |
| `src/components/create/AddChannelWizard.tsx` | Изменить | Отправлять initData в verify-channel |

---

### Детальная реализация

**1. Общая функция валидации (копируется в каждую Edge Function)**

```typescript
async function validateTelegramData(initData: string, botToken: string) {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");
    if (!hash) return { valid: false };

    urlParams.delete("hash");
    const dataCheckString = Array.from(urlParams.entries())
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join("\n");

    const encoder = new TextEncoder();
    const keyData = encoder.encode("WebAppData");
    const tokenData = encoder.encode(botToken);
    
    const hmacKey = await crypto.subtle.importKey(
      "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const secretKeyBuffer = await crypto.subtle.sign("HMAC", hmacKey, tokenData);
    
    const secretKey = await crypto.subtle.importKey(
      "raw", secretKeyBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const hashBuffer = await crypto.subtle.sign("HMAC", secretKey, encoder.encode(dataCheckString));
    
    const calculatedHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, "0")).join("");

    if (calculatedHash !== hash) return { valid: false };

    const userString = urlParams.get("user");
    const authDate = parseInt(urlParams.get("auth_date") || "0", 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) return { valid: false };

    return {
      valid: true,
      data: { user: userString ? JSON.parse(userString) : undefined, auth_date: authDate }
    };
  } catch {
    return { valid: false };
  }
}
```

---

**2. Исправление `create-campaign`**

```typescript
// БЫЛО:
const { user_id, name, text, ... } = await req.json();
// Проверка: существует ли user_id в БД (но не что он принадлежит отправителю!)

// СТАНЕТ:
const { initData, name, text, ... } = await req.json();

// 1. Валидация initData
const validation = await validateTelegramData(initData, botToken);
if (!validation.valid || !validation.data?.user) {
  return Response({ error: "Unauthorized" }, { status: 401 });
}

// 2. Находим user.id по ПРОВЕРЕННОМУ telegram_id
const telegramId = validation.data.user.id;
const { data: user } = await supabase
  .from("users")
  .select("id")
  .eq("telegram_id", telegramId)
  .single();

// 3. Создаём кампанию с ПРОВЕРЕННЫМ owner_id
await supabase.from("campaigns").insert({
  owner_id: user.id, // Теперь этому можно доверять!
  name, text, ...
});
```

---

**3. Исправление `upload-campaign-media`**

```typescript
// БЫЛО:
const formData = await req.formData();
const userId = formData.get("user_id"); // Можно подменить!
const fileName = `${userId}/${timestamp}.jpg`;

// СТАНЕТ:
const formData = await req.formData();
const initData = formData.get("initData") as string;
const file = formData.get("file") as File;

// 1. Валидация initData
const validation = await validateTelegramData(initData, botToken);
if (!validation.valid) {
  return Response({ error: "Unauthorized" }, { status: 401 });
}

// 2. Находим user.id
const { data: user } = await supabase
  .from("users")
  .select("id")
  .eq("telegram_id", validation.data.user.id)
  .single();

// 3. Загружаем в папку ПРОВЕРЕННОГО пользователя
const fileName = `${user.id}/${timestamp}.jpg`;
```

---

**4. Исправление `delete-campaign`**

```typescript
// БЫЛО:
const { campaign_id, user_id } = await req.json();
if (campaign.owner_id !== user_id) { ... } // user_id можно подменить!

// СТАНЕТ:
const { campaign_id, initData } = await req.json();

// 1. Валидация initData
const validation = await validateTelegramData(initData, botToken);

// 2. Находим user.id по telegram_id
const { data: user } = await supabase
  .from("users")
  .select("id")
  .eq("telegram_id", validation.data.user.id)
  .single();

// 3. Проверяем владение ПРОВЕРЕННЫМ user.id
if (campaign.owner_id !== user.id) {
  return Response({ error: "Access denied" }, { status: 403 });
}
```

---

**5. Исправление `verify-channel`**

```typescript
// БЫЛО:
const { username, telegram_user_id, category, ... } = await req.json();
// telegram_user_id можно подменить!
const userMember = await getChatMember(botToken, chat.id, telegram_user_id);

// СТАНЕТ:
const { username, initData, category, ... } = await req.json();

// 1. Валидация initData
const validation = await validateTelegramData(initData, botToken);
const telegramId = validation.data.user.id; // Доверенный ID

// 2. Проверяем что пользователь — админ канала
const userMember = await getChatMember(botToken, chat.id, telegramId);

// 3. Находим owner_id
const { data: user } = await supabase
  .from("users")
  .select("id")
  .eq("telegram_id", telegramId)
  .single();

// 4. Создаём канал с ПРОВЕРЕННЫМ owner_id
await supabase.from("channels").insert({
  owner_id: user.id,
  ...
});
```

---

**6. Обновление фронтенда**

**`CreateCampaignForm.tsx`:**
```typescript
import { getTelegramInitData } from "@/lib/telegram";

// При загрузке медиа:
const formData = new FormData();
formData.append("file", file);
formData.append("initData", getTelegramInitData() || ""); // Вместо user_id

// При создании кампании:
body: JSON.stringify({
  initData: getTelegramInitData(), // Вместо user_id
  name: campaignData.name,
  text: campaignData.text,
  ...
})
```

**`useUserCampaigns.ts` (delete-campaign):**
```typescript
import { getTelegramInitData } from "@/lib/telegram";

const response = await fetch(".../delete-campaign", {
  body: JSON.stringify({
    campaign_id: campaignId,
    initData: getTelegramInitData(), // Вместо user_id
  }),
});
```

**`AddChannelWizard.tsx` (verify-channel):**
```typescript
import { getTelegramInitData } from "@/lib/telegram";

body: JSON.stringify({
  username: cleanUsername,
  initData: getTelegramInitData(), // Вместо telegram_user_id
  category: channelData.category,
  ...
})
```

---

### Сравнение безопасности до/после

| Функция | До | После |
|---------|-----|-------|
| `create-campaign` | `user_id` из body | `telegram_id` из initData |
| `upload-campaign-media` | `user_id` из formData | `telegram_id` из initData |
| `delete-campaign` | `user_id` из body | `telegram_id` из initData |
| `verify-channel` | `telegram_user_id` из body | `telegram_id` из initData |

---

### Цепочка доверия после исправления

```text
┌─────────────────────────────────────────────────────────────────────┐
│  1. Telegram подписывает initData ключом бота                       │
│                              ↓                                       │
│  2. Фронтенд передаёт initData в Edge Function                      │
│                              ↓                                       │
│  3. Edge Function проверяет HMAC-SHA256 подпись                     │
│                              ↓                                       │
│  4. Извлекает telegram_id из ПРОВЕРЕННЫХ данных                     │
│                              ↓                                       │
│  5. Находит user.id в БД по telegram_id                             │
│                              ↓                                       │
│  6. Выполняет операцию только от имени ЭТОГО пользователя           │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Результат

После исправлений:
- Невозможно создать кампанию от чужого имени
- Невозможно загрузить файлы в чужую папку
- Невозможно удалить чужую кампанию
- Невозможно добавить канал от чужого имени
- Все операции проходят криптографическую валидацию
- Соответствует лучшим практикам безопасности для конкурса

