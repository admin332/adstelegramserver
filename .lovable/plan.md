

## Задача

Добавить автоматическое отклонение неодобренных сделок и возврат средств, если время до публикации истекло, а владелец канала не одобрил заказ.

## Проблема

Сейчас если реклама оплачена (статус `escrow`), но владелец канала не нажал "Одобрить" до `scheduled_at`, ничего не происходит — деньги остаются заблокированы на временном кошельке.

## Текущая архитектура

```text
cron.job #1: каждую минуту → check-escrow-payments (проверка оплаты pending сделок)
cron.job #3: каждый час → publish-scheduled-posts (публикация in_progress сделок)
```

## Решение

Расширить функцию `check-escrow-payments` (которая уже запускается каждую минуту) или создать отдельную функцию для проверки просроченных `escrow` сделок с автоматическим возвратом средств.

Рекомендуемый подход: **отдельная Edge Function** `auto-refund-expired-deals` для разделения ответственности.

### Логика работы

1. Найти сделки со статусом `escrow`, где `scheduled_at < NOW()`
2. Для каждой такой сделки:
   - Расшифровать мнемонику эскроу-кошелька
   - Получить адрес кошелька рекламодателя
   - Отправить TON обратно (минус комиссия сети)
   - Обновить статус сделки на `cancelled` с причиной `auto_expired`
   - Отправить уведомление рекламодателю и владельцу канала
3. Запускать раз в час через cron

### Часть 1: Новая Edge Function `auto-refund-expired-deals`

```typescript
// supabase/functions/auto-refund-expired-deals/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createDecipheriv } from "node:crypto";
import { Buffer } from "node:buffer";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { WalletContractV4, TonClient, internal, SendMode } from "@ton/ton";

// Расшифровка мнемоники
function decryptMnemonic(encrypted: string, key: string): string {
  const [ivHex, authTagHex, encryptedData] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const keyBuffer = Buffer.from(key, "hex");
  
  const decipher = createDecipheriv("aes-256-gcm", keyBuffer, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

// Отправка TON с эскроу-кошелька
async function sendRefund(
  encryptedMnemonic: string,
  encryptionKey: string,
  toAddress: string,
  amountTon: number
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    // 1. Расшифровать мнемонику
    const mnemonic = decryptMnemonic(encryptedMnemonic, encryptionKey);
    const mnemonicArray = mnemonic.split(" ");
    
    // 2. Получить keypair
    const keyPair = await mnemonicToPrivateKey(mnemonicArray);
    
    // 3. Создать клиент
    const client = new TonClient({
      endpoint: "https://toncenter.com/api/v2/jsonRPC",
      apiKey: Deno.env.get("TONCENTER_API_KEY"),
    });
    
    // 4. Создать контракт кошелька
    const wallet = WalletContractV4.create({
      publicKey: keyPair.publicKey,
      workchain: 0,
    });
    
    const contract = client.open(wallet);
    
    // 5. Проверить баланс
    const balance = await contract.getBalance();
    const networkFee = 0.01 * 1_000_000_000n; // ~0.01 TON на комиссию
    const refundAmount = balance - networkFee;
    
    if (refundAmount <= 0n) {
      return { success: false, error: "Insufficient balance for refund" };
    }
    
    // 6. Получить seqno
    const seqno = await contract.getSeqno();
    
    // 7. Отправить транзакцию
    await contract.sendTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      messages: [
        internal({
          to: toAddress,
          value: refundAmount,
          body: "Adsingo refund",
        }),
      ],
    });
    
    return { success: true };
  } catch (error) {
    console.error("Refund error:", error);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  // Основная логика:
  // 1. Найти сделки escrow где scheduled_at < NOW()
  // 2. Для каждой: refund + update status + notify
});
```

### Часть 2: Схема базы данных

Добавить колонку для хранения причины отмены:

```sql
ALTER TABLE deals ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
```

Возможные значения: `owner_rejected`, `auto_expired`, `advertiser_cancelled`

### Часть 3: Cron Job

Добавить cron job для запуска раз в час (в :30 минут, чтобы не конфликтовать с publish-scheduled-posts):

```sql
SELECT cron.schedule(
  'auto-refund-expired-deals',
  '30 * * * *', -- каждый час в :30
  $$
  SELECT net.http_post(
    url:='https://fdxyittddmpyhaiijddp.supabase.co/functions/v1/auto-refund-expired-deals',
    headers:='{"Authorization": "Bearer ANON_KEY"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);
```

## Файлы для изменения

| Файл | Изменения |
|------|-----------|
| `supabase/functions/auto-refund-expired-deals/index.ts` | Создать новую Edge Function |
| `supabase/config.toml` | Добавить конфигурацию новой функции |
| База данных | Добавить cron job + колонку cancellation_reason |

## Потребуется секрет

- `TONCENTER_API_KEY` — для отправки транзакций (может уже быть настроен)

## Уведомления

**Рекламодателю:**
```
💔 Время публикации истекло

К сожалению, владелец канала {channelTitle} не успел одобрить вашу рекламу до запланированного времени.

💰 Возврат: {amount} TON отправлен на ваш кошелёк.
```

**Владельцу канала:**
```
⏰ Сделка автоматически отменена

Вы не одобрили рекламу до запланированного времени публикации.

Средства возвращены рекламодателю.
```

## Визуальная схема

```text
┌─────────────────────────────────────────────────────┐
│              DEAL LIFECYCLE                          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  pending ─(оплата)──► escrow ─(одобрение)──► in_progress ─(публикация)──► completed
│     │                    │                                                    
│     │                    │                                                    
│  (timeout 20m)       (scheduled_at прошёл                                   
│     ▼                 без одобрения)                                         
│  expired                 ▼                                                    
│                      cancelled                                               
│                   + auto refund                                              
│                   + уведомления                                              
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Техническая детализация

### Функция расшифровки мнемоники

Обратная операция к `encryptMnemonic` из `create-deal`:

```typescript
function decryptMnemonic(encrypted: string, key: string): string {
  const [ivHex, authTagHex, encryptedData] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const keyBuffer = Buffer.from(key, "hex");
  
  const decipher = createDecipheriv("aes-256-gcm", keyBuffer, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}
```

### Получение адреса рекламодателя

Адрес кошелька рекламодателя хранится в `users.wallet_address`. Его мы получаем через JOIN:

```typescript
const { data: expiredDeals } = await supabase
  .from("deals")
  .select(`
    id,
    escrow_mnemonic_encrypted,
    total_price,
    channel:channels(title, username, owner:users!channels_owner_id_fkey(telegram_id)),
    advertiser:users!deals_advertiser_id_fkey(telegram_id, wallet_address)
  `)
  .eq("status", "escrow")
  .lt("scheduled_at", now);
```

### Обработка ошибок

- Если `wallet_address` рекламодателя отсутствует — логируем ошибку, статус не меняем
- Если транзакция не прошла — логируем, пробуем повторно в следующий запуск
- Если мнемоника не расшифровывается — критическая ошибка, требует ручного вмешательства

