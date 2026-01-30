

## Исправление возврата средств при удалении поста

### Проблема

Функция `verify-post-integrity` обнаруживает удалённые посты, отправляет уведомления и обновляет статус сделки, но **не выполняет реальный перевод TON**!

В логах видно:
```
Would refund 1 TON to UQCjFlYw_bBPeX5YfUNgLOT1T0G3UUxya7P1Upb63V7XHgKR
```

Это просто `console.log` — заглушка (placeholder).

---

## Сравнение реализаций

| Функция | Реальный перевод | Статус |
|---------|------------------|--------|
| `auto-refund-expired-deals` | ✅ Да | Работает |
| `admin-cancel-deal` | ✅ Да | Работает |
| `verify-post-integrity` | ❌ Нет | **Сломано** |

---

## Что нужно исправить

Добавить в `verify-post-integrity` полноценную логику возврата TON, аналогичную `admin-cancel-deal`.

---

## Технические изменения

**Файл:** `supabase/functions/verify-post-integrity/index.ts`

### 1. Добавить импорты TON SDK

```typescript
import { mnemonicToPrivateKey } from "@ton/crypto";
import { WalletContractV4, TonClient, internal, SendMode } from "@ton/ton";
```

### 2. Добавить TONCENTER_API_KEY

```typescript
const TONCENTER_API_KEY = Deno.env.get("TONCENTER_API_KEY")!;
```

### 3. Заменить функцию `decryptMnemonic` на рабочую версию

Текущая версия возвращает пустую строку. Нужно использовать Web Crypto API как в `admin-cancel-deal`:

```typescript
async function decryptMnemonic(encryptedData: string): Promise<string[]> {
  const [ivHex, authTagHex, encryptedHex] = encryptedData.split(":");
  
  const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const authTag = new Uint8Array(authTagHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const encrypted = new Uint8Array(encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  
  const ciphertextWithTag = new Uint8Array(encrypted.length + authTag.length);
  ciphertextWithTag.set(encrypted);
  ciphertextWithTag.set(authTag, encrypted.length);
  
  const keyBuffer = new Uint8Array(ENCRYPTION_KEY.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyBuffer, { name: "AES-GCM" }, false, ["decrypt"]
  );
  
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv }, cryptoKey, ciphertextWithTag
  );
  
  return new TextDecoder().decode(decrypted).split(" ");
}
```

### 4. Заменить функцию `refundToAdvertiser` на рабочую версию

```typescript
async function refundToAdvertiser(deal: Deal): Promise<boolean> {
  const { data: advertiser } = await supabase
    .from("users")
    .select("wallet_address")
    .eq("id", deal.advertiser_id)
    .single();

  if (!advertiser?.wallet_address || !deal.escrow_mnemonic_encrypted) {
    console.error("Missing wallet or mnemonic for refund");
    return false;
  }

  try {
    const mnemonicWords = await decryptMnemonic(deal.escrow_mnemonic_encrypted);
    
    if (mnemonicWords.length === 0) {
      console.error("Could not decrypt mnemonic");
      return false;
    }

    const keyPair = await mnemonicToPrivateKey(mnemonicWords);
    
    const client = new TonClient({
      endpoint: "https://toncenter.com/api/v2/jsonRPC",
      apiKey: TONCENTER_API_KEY,
    });

    const wallet = WalletContractV4.create({
      publicKey: keyPair.publicKey,
      workchain: 0,
    });
    
    const contract = client.open(wallet);
    const balance = await contract.getBalance();
    const networkFee = BigInt(0.02 * 1_000_000_000);
    const refundAmount = balance - networkFee;

    if (refundAmount <= 0n) {
      console.error("Insufficient balance for refund");
      return false;
    }

    const seqno = await contract.getSeqno();
    await contract.sendTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      messages: [
        internal({
          to: advertiser.wallet_address,
          value: refundAmount,
          body: "Adsingo refund - post deleted",
        }),
      ],
    });

    console.log(`Refund sent: ${refundAmount} nanoTON to ${advertiser.wallet_address}`);
    return true;
  } catch (error) {
    console.error("Refund error:", error);
    return false;
  }
}
```

---

## Результат после исправления

| Событие | Сейчас | После |
|---------|--------|-------|
| Пост удалён | Уведомление + статус ✅, деньги ❌ | Уведомление + статус + **деньги ✅** |

