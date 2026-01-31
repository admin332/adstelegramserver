

## Исправление получения universalLink для оплаты

### Корневая причина проблемы

Сейчас код пытается получить ссылку так:
```typescript
const walletInfo = (wallet as any)?.walletInfo;  // ❌ Приватное поле!
return walletInfo?.universalLink || null;
```

Но `walletInfo` — это **приватное** поле SDK, недоступное снаружи. Поэтому всегда `null`.

### Правильная структура данных

Согласно типам TonConnect SDK:
- `tonConnectUI.wallet` возвращает `ConnectedWallet | null`
- `ConnectedWallet` = `Wallet & WalletInfoWithOpenMethod`
- `WalletInfoWithOpenMethod` включает `WalletInfoRemote` с полем `universalLink`

То есть `universalLink` находится **прямо на объекте `wallet`**, а не внутри вложенного `walletInfo`:
```typescript
const wallet = tonConnectUI.wallet;
const link = (wallet as any)?.universalLink;  // ✅ Напрямую!
```

---

## План изменений

### 1. `src/components/channel/PaymentStep.tsx`

Исправить функцию `getConnectedWalletLink`:

```typescript
// Было (неправильно):
const getConnectedWalletLink = (): string | null => {
  const wallet = tonConnectUI.wallet;
  const walletInfo = (wallet as any)?.walletInfo;  // ❌ Не существует
  return walletInfo?.universalLink || null;
};

// Станет (правильно):
const getConnectedWalletLink = (): string | null => {
  const wallet = tonConnectUI.wallet;
  if (!wallet) return null;
  
  // universalLink находится прямо на ConnectedWallet
  // (Wallet & WalletInfoRemote содержит universalLink)
  const link = (wallet as any).universalLink;
  
  // Добавляем логирование для отладки
  console.log('[TonConnect] wallet:', wallet);
  console.log('[TonConnect] universalLink:', link);
  
  return link || null;
};
```

---

### 2. `src/components/deals/PaymentDialog.tsx`

Аналогичное исправление:

```typescript
// Было:
const getConnectedWalletLink = (): string | null => {
  const wallet = tonConnectUI.wallet;
  const walletInfo = (wallet as any)?.walletInfo;
  return walletInfo?.universalLink || null;
};

// Станет:
const getConnectedWalletLink = (): string | null => {
  const wallet = tonConnectUI.wallet;
  if (!wallet) return null;
  
  const link = (wallet as any).universalLink;
  console.log('[TonConnect] wallet:', wallet);
  console.log('[TonConnect] universalLink:', link);
  
  return link || null;
};
```

---

## Почему так работает

| Тип | Что содержит |
|-----|--------------|
| `Wallet` | `device`, `provider`, `account`, `connectItems` |
| `WalletInfoRemote` | `universalLink`, `bridgeUrl`, `deepLink` |
| `ConnectedWallet` | `Wallet` + `WalletInfoRemote` = всё вместе |

При подключении через HTTP bridge (MyTonWallet, Tonkeeper) SDK сохраняет `universalLink` **прямо на объекте** `wallet`, не во вложенном поле.

---

## Также важно: проверка домена в манифесте

Вы тестируете на `adsingo.online`, а в `tonconnect-manifest.json` указан:
```json
{
  "url": "https://adsingo.online"
}
```

Это правильно! Если бы домен не совпадал, кошелёк бы не подключался вообще.

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/components/channel/PaymentStep.tsx` | Исправить `getConnectedWalletLink`: читать `wallet.universalLink` напрямую |
| `src/components/deals/PaymentDialog.tsx` | То же самое |

---

## После изменений

1. Нажимаете "Оплатить"
2. В консоли увидите `[TonConnect] wallet:` и `universalLink:`
3. Если `universalLink` есть — откроется MyTonWallet
4. Если нет — покажется ошибка (но уже с понятной причиной в логах)

