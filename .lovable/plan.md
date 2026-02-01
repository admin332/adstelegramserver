

## План: Уведомления для всей команды канала (владелец + менеджеры)

### Текущее поведение

| Аспект | Сейчас | Проблема |
|--------|--------|----------|
| **Выплаты** | Идут только владельцу (`channel.owner_id`) | ✅ Правильно |
| **Уведомления** | Только владельцу | ❌ Менеджеры не видят процесс |

### Новое поведение

- **Выплаты**: Всегда только владельцу канала (без изменений)
- **Уведомления**: Отправляются И владельцу, И всем менеджерам канала

---

## Техническая реализация

### 1. Создание хелпер-функции для получения всех telegram_id команды

Во всех edge-функциях, где отправляются уведомления, нужно добавить логику получения telegram_id всех администраторов канала:

```typescript
async function getChannelTeamTelegramIds(channelId: string): Promise<number[]> {
  // Get all admins (owner + managers) for this channel
  const { data: admins } = await supabase
    .from("channel_admins")
    .select("user_id")
    .eq("channel_id", channelId);

  if (!admins || admins.length === 0) return [];

  // Get telegram_id for each admin
  const userIds = admins.map(a => a.user_id);
  const { data: users } = await supabase
    .from("users")
    .select("telegram_id")
    .in("id", userIds);

  return users
    ?.map(u => u.telegram_id)
    .filter((id): id is number => id !== null) || [];
}
```

### 2. Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `check-escrow-payments/index.ts` | Уведомление об оплате → всей команде |
| `telegram-webhook/index.ts` | Все уведомления (черновик, одобрение, доработка, выбор версии) → всей команде |
| `complete-posted-deals/index.ts` | Уведомление о завершении + оплате → всей команде (но выплата только владельцу!) |
| `auto-timeout-deals/index.ts` | Уведомления о таймаутах → всей команде |
| `verify-post-integrity/index.ts` | Уведомление об удалении поста → всей команде |

### 3. Детальные изменения

#### 3.1 check-escrow-payments/index.ts

Текущий код (строка 214-317):
```typescript
async function sendOwnerNotification(deal: Deal) {
  const ownerTelegramId = deal.channel.owner.telegram_id;
  // Отправляет только владельцу
}
```

Новый код:
```typescript
async function sendTeamNotification(deal: Deal, supabase: SupabaseClient) {
  // Get all team members
  const teamIds = await getChannelTeamTelegramIds(deal.channel.id, supabase);
  
  // Send to each team member
  for (const telegramId of teamIds) {
    // ... existing notification logic
  }
}
```

#### 3.2 telegram-webhook/index.ts

Функции для обновления:

**handleRevisionComment (строка 817-844):**
```typescript
// Сейчас:
if (owner?.telegram_id) {
  await sendTelegramMessage(owner.telegram_id, revisionMessage);
}

// Новое:
const teamIds = await getChannelTeamTelegramIds(deal.channel_id);
for (const telegramId of teamIds) {
  await sendTelegramMessage(telegramId, revisionMessage);
}
```

**handleDraftApproval (строка 665-672):**
```typescript
// Сейчас: только owner
if (owner?.telegram_id) {
  await sendTelegramMessage(owner.telegram_id, message);
}

// Новое: вся команда
const teamIds = await getChannelTeamTelegramIds(deal.channel_id);
for (const telegramId of teamIds) {
  await sendTelegramMessage(telegramId, message);
}
```

**handleVersionSelect (строка 966-972):**
```typescript
// Аналогичное изменение
```

#### 3.3 complete-posted-deals/index.ts

**КРИТИЧНО**: Выплата идёт ТОЛЬКО владельцу, но уведомления — всей команде.

```typescript
// Строка 256-260: Получаем владельца для выплаты
const { data: owner } = await supabase
  .from("users")
  .select("telegram_id, wallet_address")
  .eq("id", deal.channel.owner_id)  // ← Только владелец получает деньги
  .single();

// Строка 315-319: Выплата
if (owner?.wallet_address && deal.escrow_mnemonic_encrypted) {
  const transferResult = await transferToOwner(
    deal.escrow_mnemonic_encrypted,
    owner.wallet_address,  // ← Только владелец
    deal.total_price
  );
}

// Строка 434-447: Уведомление
// ИЗМЕНИТЬ на:
const teamIds = await getChannelTeamTelegramIds(deal.channel_id);
for (const telegramId of teamIds) {
  // Персонализированное сообщение
  const isOwner = telegramId === owner?.telegram_id;
  
  if (isOwner) {
    // Владельцу: с информацией о выплате
    await sendTelegramMessage(telegramId, 
      `💰 <b>Оплата получена!</b>\n\n💎 <b>${deal.total_price} TON</b> переведены на ваш кошелёк.`
    );
  } else {
    // Менеджерам: без информации о деньгах
    await sendTelegramMessage(telegramId,
      `✅ <b>Сделка завершена!</b>\n\nРеклама в канале <b>${channelTitle}</b> успешно отработала.`
    );
  }
}
```

#### 3.4 auto-timeout-deals/index.ts

Аналогичные изменения для уведомлений о таймаутах:
- Строка 264-282: Owner timeout notification → всей команде
- Строка 381-398: Advertiser timeout notification → всей команде

---

## Логика персонализации уведомлений

| Событие | Владелец | Менеджеры |
|---------|----------|-----------|
| Оплата сделки | "Вы получите X TON" | "Новый заказ на X TON" |
| Черновик на доработку | Полное сообщение | Полное сообщение |
| Все посты одобрены | Полное сообщение | Полное сообщение |
| Сделка завершена | "X TON переведены на ваш кошелёк" | "Сделка завершена" |
| Таймаут владельца | "Вы не отправили черновик" | "Сделка отменена — черновик не отправлен" |
| Таймаут рекламодателя | "Вы получили 30%" | "Сделка автоматически закрыта" |

---

## Итоговая структура хелпера

```typescript
// Общий хелпер для всех edge-функций
async function getChannelTeamTelegramIds(
  channelId: string, 
  supabase: SupabaseClient
): Promise<number[]> {
  const { data: admins } = await supabase
    .from("channel_admins")
    .select("user_id")
    .eq("channel_id", channelId);

  if (!admins?.length) return [];

  const { data: users } = await supabase
    .from("users")
    .select("telegram_id")
    .in("id", admins.map(a => a.user_id));

  return users
    ?.map(u => u.telegram_id)
    .filter((id): id is number => id !== null) || [];
}

// Для отправки персонализированных уведомлений
async function notifyChannelTeam(
  channelId: string,
  ownerId: string | null,
  ownerMessage: string,
  managerMessage: string,
  supabase: SupabaseClient
) {
  const { data: admins } = await supabase
    .from("channel_admins")
    .select("user_id, user:users(telegram_id)")
    .eq("channel_id", channelId);

  const { data: channel } = await supabase
    .from("channels")
    .select("owner_id")
    .eq("id", channelId)
    .single();

  for (const admin of admins || []) {
    const user = Array.isArray(admin.user) ? admin.user[0] : admin.user;
    if (!user?.telegram_id) continue;

    const isOwner = admin.user_id === channel?.owner_id;
    await sendTelegramMessage(
      user.telegram_id, 
      isOwner ? ownerMessage : managerMessage
    );
  }
}
```

---

## Проверка выплат (подтверждение)

Во всех функциях выплата определяется через:
```typescript
const { data: owner } = await supabase
  .from("users")
  .select("wallet_address")
  .eq("id", channel.owner_id)  // ← Всегда owner_id, не из channel_admins
  .single();
```

Это гарантирует, что менеджеры НИКОГДА не получат выплату.

