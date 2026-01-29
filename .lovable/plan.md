

# Исправление расшифровки мнемоники для перевода средств

## Проблема

Функции `admin-complete-deal` и `complete-posted-deals` используют неправильный алгоритм расшифровки мнемоники. 

**Формат хранения** (в `create-deal`):
```
iv_hex:authTag_hex:encrypted_hex
```

**Что ожидает расшифровка** (сейчас):
```
base64(iv + ciphertext + authTag)
```

Из-за этого `atob()` падает с ошибкой `Failed to decode base64`.

## Решение

Переписать функцию `decryptMnemonic` с правильной логикой:

1. Разделить строку по `:`
2. Декодировать IV, authTag и encrypted из hex
3. Использовать `SubtleCrypto.decrypt()` с AES-256-GCM
4. Вернуть массив слов мнемоники

## Изменения

### 1. Исправить `decryptMnemonic` в обеих Edge Functions

```typescript
async function decryptMnemonic(encryptedData: string): Promise<string[]> {
  try {
    const ENCRYPTION_KEY = Deno.env.get("ENCRYPTION_KEY")!;
    
    // Формат: iv:authTag:encrypted (все в hex)
    const parts = encryptedData.split(":");
    if (parts.length !== 3) {
      console.error("Invalid encrypted format - expected 3 parts separated by ':'");
      return [];
    }
    
    const [ivHex, authTagHex, encryptedHex] = parts;
    
    // Декодируем из hex
    const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const authTag = new Uint8Array(authTagHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const encrypted = new Uint8Array(encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    
    // Собираем ciphertext + authTag для SubtleCrypto
    const ciphertextWithTag = new Uint8Array(encrypted.length + authTag.length);
    ciphertextWithTag.set(encrypted);
    ciphertextWithTag.set(authTag, encrypted.length);
    
    // Импортируем ключ
    const keyBuffer = new Uint8Array(ENCRYPTION_KEY.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );
    
    // Расшифровываем
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      ciphertextWithTag
    );
    
    const mnemonicString = new TextDecoder().decode(decrypted);
    return mnemonicString.split(" ");
  } catch (error) {
    console.error("Decryption error:", error);
    return [];
  }
}
```

### 2. Обновить вызовы функции

Сделать функцию `async` и добавить `await`:

```typescript
// Было
const mnemonicWords = decryptMnemonic(encryptedMnemonic);

// Станет
const mnemonicWords = await decryptMnemonic(encryptedMnemonic);
```

## Файлы к изменению

| Файл | Изменение |
|------|-----------|
| `supabase/functions/admin-complete-deal/index.ts` | Исправить `decryptMnemonic` |
| `supabase/functions/admin-cancel-deal/index.ts` | Исправить `decryptMnemonic` |
| `supabase/functions/complete-posted-deals/index.ts` | Исправить `decryptMnemonic` |
| `supabase/functions/auto-refund-expired-deals/index.ts` | Исправить `decryptMnemonic` (если есть) |

## Результат

После исправления:
- Админ меняет статус на "Завершено" → средства сразу переводятся владельцу
- Автоматическое завершение сделок работает корректно
- Рефанды при отмене работают корректно

