

## Проблема

Текущая функция `generateEscrowAddress()` генерирует **фейковый адрес**:

```typescript
// Текущий код — НЕПРАВИЛЬНЫЙ
const addressBytes = randomBytes(32);
const addressBase64 = addressBytes.toString("base64url");
const address = `UQ${addressBase64.substring(0, 46)}`; // ❌ Это не настоящий TON адрес!
```

Этот адрес не существует в блокчейне и никогда не будет принят кошельками.

## Решение

Переписать генерацию эскроу-кошелька с использованием библиотек `@ton/ton` и `@ton/crypto` для создания **реального TON кошелька**.

## Изменения в файле `supabase/functions/create-deal/index.ts`

### 1. Обновить импорты

```typescript
import { mnemonicNew, mnemonicToPrivateKey } from "npm:@ton/crypto@3";
import { WalletContractV4 } from "npm:@ton/ton@15";
```

### 2. Переписать функцию генерации кошелька

```typescript
async function generateEscrowWallet(): Promise<{ 
  address: string; 
  mnemonic: string;
}> {
  // Генерируем мнемоническую фразу (24 слова)
  const mnemonic = await mnemonicNew();
  
  // Получаем keypair из мнемоники
  const keyPair = await mnemonicToPrivateKey(mnemonic);
  
  // Создаём контракт кошелька V4
  const wallet = WalletContractV4.create({
    publicKey: keyPair.publicKey,
    workchain: 0,
  });
  
  // Получаем адрес в формате EQ (Bounceable) — понимают все кошельки
  const address = wallet.address.toString({
    bounceable: true,
    testOnly: false,
  });
  
  return {
    address,
    mnemonic: mnemonic.join(" "),
  };
}
```

### 3. Обновить вызов функции

Функция теперь асинхронная, поэтому вызов меняется на:

```typescript
// Было:
const escrowWallet = generateEscrowAddress();

// Стало:
const escrowWallet = await generateEscrowWallet();

// Шифруем мнемонику (не секретный ключ)
const encryptedMnemonic = encryptMnemonic(escrowWallet.mnemonic, encryptionKey);
```

## Результат

| До | После |
|---|---|
| `UQ` + случайные символы | `EQ` + валидный адрес кошелька V4 |
| Адрес не существует в блокчейне | Реальный адрес, готовый принять TON |
| Кошельки отклоняют | Все кошельки принимают |

## Формат адресов TON

- **EQ...** (Bounceable) — стандартный формат, понимают все кошельки
- **UQ...** (Non-bounceable) — для неинициализированных контрактов

Мы будем использовать **EQ** формат (`bounceable: true`), так как он наиболее совместим со всеми кошельками.

## Техническая часть

### Структура нового кода

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac, createCipheriv, randomBytes } from "node:crypto";
import { Buffer } from "node:buffer";
import { mnemonicNew, mnemonicToPrivateKey } from "npm:@ton/crypto@3";
import { WalletContractV4 } from "npm:@ton/ton@15";

// ... corsHeaders, validateTelegramInitData, encryptMnemonic остаются ...

// Новая функция генерации настоящего TON кошелька
async function generateEscrowWallet(): Promise<{ address: string; mnemonic: string }> {
  const mnemonic = await mnemonicNew();
  const keyPair = await mnemonicToPrivateKey(mnemonic);
  
  const wallet = WalletContractV4.create({
    publicKey: keyPair.publicKey,
    workchain: 0,
  });
  
  // EQ формат — совместим со всеми кошельками
  const address = wallet.address.toString({
    bounceable: true,
    testOnly: false,
  });
  
  return { address, mnemonic: mnemonic.join(" ") };
}

serve(async (req) => {
  // ... валидация ...
  
  // Генерация реального эскроу-кошелька
  const escrowWallet = await generateEscrowWallet();
  const encryptedMnemonic = encryptMnemonic(escrowWallet.mnemonic, encryptionKey);
  
  // ... создание сделки с настоящим адресом ...
});
```

