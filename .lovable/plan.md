

## Задача

Добавить:
1. Автоматический перевод TON владельцу канала при успешном завершении сделки
2. Проверку наличия поста каждые 4 часа (если удалён/изменён — возврат рекламодателю)

---

## Часть 1: Сохранение message_id при публикации

### Изменение схемы базы данных

```sql
ALTER TABLE public.deals ADD COLUMN telegram_message_id bigint;
ALTER TABLE public.deals ADD COLUMN last_integrity_check_at timestamp with time zone;
```

### Изменение publish-scheduled-posts

При отправке сообщения Telegram API возвращает `message_id`. Нужно его сохранить:

```typescript
// publishToChannel теперь возвращает message_id
async function publishToChannel(chatId: number, campaign: Campaign): Promise<number> {
  // ...отправка сообщения...
  const result = await sendTelegramRequest("sendMessage", {...});
  return result.result.message_id;  // ← Сохраняем
}

// В processDeal — сохраняем message_id в базу
const messageId = await publishToChannel(channel.telegram_chat_id, campaign);
await supabase.from("deals").update({
  posted_at: new Date().toISOString(),
  telegram_message_id: messageId,
}).eq("id", deal.id);
```

---

## Часть 2: Проверка целостности поста каждые 4 часа

### Новая Edge Function: verify-post-integrity

Логика проверки наличия поста:

```typescript
// Способ проверки: copyMessage с chat_id=бота (dry run не поддерживается)
// Если сообщение удалено — ошибка "message to copy not found"
// Если изменено — проверяем текст через forwardMessage + сравнение

async function checkPostExists(chatId: number, messageId: number): Promise<boolean> {
  try {
    // Используем copyMessage к самому боту — если пост удалён, будет ошибка
    const result = await sendTelegramRequest("copyMessage", {
      chat_id: BOT_CHAT_ID,  // ID чата бота с самим собой
      from_chat_id: chatId,
      message_id: messageId,
    });
    
    // Удаляем скопированное сообщение сразу
    if (result.ok) {
      await sendTelegramRequest("deleteMessage", {
        chat_id: BOT_CHAT_ID,
        message_id: result.result.message_id,
      });
    }
    
    return result.ok;
  } catch {
    return false;  // Пост удалён
  }
}
```

### Алгоритм функции

```text
1. Найти все deals:
   - status = 'in_progress'
   - posted_at IS NOT NULL
   - telegram_message_id IS NOT NULL
   - (last_integrity_check_at IS NULL OR last_integrity_check_at < NOW() - 4 hours)

2. Для каждой сделки:
   a. Проверить существование поста
   b. Если пост удалён → возврат рекламодателю, статус 'cancelled'
   c. Если пост на месте → обновить last_integrity_check_at
```

---

## Часть 3: Автоматический перевод средств при завершении

### Изменение complete-posted-deals

Добавить логику перевода TON после успешного завершения:

```typescript
import { decryptMnemonic } from "./crypto";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { WalletContractV4, TonClient, internal, SendMode } from "@ton/ton";

async function transferToOwner(
  encryptedMnemonic: string,
  ownerWalletAddress: string,
  amount: number
): Promise<{ success: boolean; error?: string }> {
  // 1. Расшифровать мнемонику
  const mnemonic = decryptMnemonic(encryptedMnemonic, ENCRYPTION_KEY);
  const keyPair = await mnemonicToPrivateKey(mnemonic.split(" "));
  
  // 2. Открыть escrow-кошелёк
  const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
  const contract = client.open(wallet);
  
  // 3. Проверить баланс
  const balance = await contract.getBalance();
  const networkFee = BigInt(0.02 * 1_000_000_000);  // ~0.02 TON
  const transferAmount = balance - networkFee;
  
  if (transferAmount <= 0n) {
    return { success: false, error: "Insufficient balance" };
  }
  
  // 4. Отправить средства владельцу
  const seqno = await contract.getSeqno();
  await contract.sendTransfer({
    seqno,
    secretKey: keyPair.secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    messages: [
      internal({
        to: ownerWalletAddress,
        value: transferAmount,
        body: "Adsingo payment - ad completed successfully",
      }),
    ],
  });
  
  return { success: true };
}
```

### Интеграция в processDeal

```typescript
async function processDeal(deal: Deal): Promise<{ success: boolean; error?: string }> {
  // 1. Финальная проверка поста
  const postExists = await checkPostExists(channel.telegram_chat_id, deal.telegram_message_id);
  
  if (!postExists) {
    // Пост удалён — возврат рекламодателю
    await refundToAdvertiser(deal);
    return { success: true, refunded: true };
  }
  
  // 2. Перевод владельцу канала
  if (owner?.wallet_address && deal.escrow_mnemonic_encrypted) {
    const transferResult = await transferToOwner(
      deal.escrow_mnemonic_encrypted,
      owner.wallet_address,
      deal.total_price
    );
    
    if (!transferResult.success) {
      console.error(`Transfer failed: ${transferResult.error}`);
      // Не блокируем завершение, уведомим о проблеме
    }
  }
  
  // 3. Обновить статус
  await supabase.from("deals").update({
    status: "completed",
    completed_at: new Date().toISOString(),
  }).eq("id", deal.id);
  
  // 4. Уведомления
  // ...
}
```

---

## Часть 4: Cron Jobs

### Существующие cron jobs:
- `check-escrow-payments` — каждую минуту
- `publish-scheduled-posts` — каждый час (в :00)
- `complete-posted-deals` — каждый час (в :15)

### Новый cron job:

```sql
SELECT cron.schedule(
  'verify-post-integrity',
  '30 */4 * * *',  -- каждые 4 часа в :30
  $$
  SELECT net.http_post(
    url:='https://fdxyittddmpyhaiijddp.supabase.co/functions/v1/verify-post-integrity',
    headers:='{"Authorization": "Bearer ANON_KEY", "Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);
```

---

## Файлы для создания/изменения

| Файл | Действие |
|------|----------|
| `supabase/functions/publish-scheduled-posts/index.ts` | Сохранять telegram_message_id |
| `supabase/functions/verify-post-integrity/index.ts` | Создать новую функцию |
| `supabase/functions/complete-posted-deals/index.ts` | Добавить перевод TON |
| `supabase/config.toml` | Зарегистрировать функцию |
| База данных | Добавить колонки + cron job |

---

## Визуальная схема процесса

```text
                    ┌─────────────────────────────────────┐
                    │          ПУБЛИКАЦИЯ                 │
                    │   publish-scheduled-posts           │
                    │   → сохраняет telegram_message_id   │
                    └─────────────┬───────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         IN_PROGRESS                                 │
│                     (posted_at заполнен)                            │
└─────────────────────────────────────────────────────────────────────┘
                    │                             │
          каждые 4 часа                   duration_hours истёк
                    │                             │
                    ▼                             ▼
        ┌───────────────────────┐    ┌────────────────────────────┐
        │ verify-post-integrity │    │   complete-posted-deals    │
        │                       │    │                            │
        │ copyMessage проверка  │    │ 1. Финальная проверка      │
        └───────────┬───────────┘    │    поста                   │
                    │                │ 2. Перевод TON владельцу   │
           ┌────────┴────────┐       │    или возврат             │
           │                 │       │ 3. Статус → completed      │
        Пост есть       Пост удалён  └────────────────────────────┘
           │                 │
           ▼                 ▼
   last_integrity_    ┌──────────────────────┐
   check_at = NOW()   │ Возврат рекламодателю│
                      │ status = 'cancelled' │
                      │ reason = 'post_deleted'│
                      └──────────────────────┘
```

---

## Уведомления

### При удалении поста (рекламодателю):

```text
⚠️ <b>Пост удалён из канала</b>

Ваша реклама в канале {channelTitle} была удалена до окончания срока размещения.

💰 <b>Возврат:</b> {total_price} TON отправлен на ваш кошелёк.
```

### При удалении поста (владельцу канала):

```text
🚫 <b>Сделка отменена</b>

Рекламный пост в канале {channelTitle} был удалён до окончания срока размещения.

Средства возвращены рекламодателю. Подобные действия могут привести к понижению рейтинга.
```

### При успешном завершении (владельцу):

```text
💰 <b>Оплата получена!</b>

Реклама в канале {channelTitle} успешно отработала.

<b>{total_price} TON</b> переведены на ваш кошелёк.

Спасибо за использование Adsingo! 🚀
```

---

## Технические детали

### Проверка изменения контента (опционально)

Для полной проверки можно сравнивать контент:

```typescript
// При публикации сохраняем хеш контента
const contentHash = crypto.createHash('md5')
  .update(campaign.text + JSON.stringify(campaign.media_urls))
  .digest('hex');

// При проверке — получаем сообщение через forwardMessage и сравниваем
```

**Примечание:** Telegram Bot API не предоставляет getMessages для каналов. Можно использовать:
1. `copyMessage` — проверяет только существование
2. `forwardMessage` — пересылает сообщение, можно сравнить текст

Для MVP достаточно проверки существования через `copyMessage`.

### Обработка ошибок TON-переводов

```typescript
// Если перевод не удался — логируем и уведомляем
// Сделка всё равно завершается, но владелец получает уведомление
// Администратор может вручную произвести перевод
```

