

## Исправление: НЕ открывать браузер для Telegram Wallet

### Проблема

Сейчас код проверяет `wallet.provider === 'injected'`, но **Telegram Wallet** может не определяться таким образом. В результате для него всё равно вызывается `openWalletLink()`, что открывает браузер.

Согласно типам TonConnect SDK:
- `Wallet.device.appName` содержит название кошелька (например `'telegram-wallet'`)
- Для Telegram Wallet нужно **не открывать внешние ссылки** — он работает прямо внутри Telegram

### Решение

Определять Telegram Wallet по `device.appName`:

```typescript
const wallet = tonConnectUI.wallet;

// Telegram Wallet определяется по appName, не по provider!
const isTelegramWallet = wallet?.device?.appName?.toLowerCase().includes('telegram');

// Также проверяем injected как fallback
const isInjectedWallet = wallet?.provider === 'injected';

// Для Telegram Wallet и injected кошельков — не открываем внешние ссылки
const shouldOpenExternalWallet = !isTelegramWallet && !isInjectedWallet;
```

---

## Изменения

### Файл 1: `src/components/channel/PaymentStep.tsx`

**Строки ~77-130** — изменить логику `handlePayViaWallet`:

```typescript
const handlePayViaWallet = () => {
  if (!escrowAddress) return;
  
  setIsPaying(true);
  
  const wallet = tonConnectUI.wallet;
  
  // Telegram Wallet определяется по appName устройства
  const isTelegramWallet = wallet?.device?.appName?.toLowerCase().includes('telegram');
  
  // Также проверяем injected как fallback для других встроенных кошельков
  const isInjectedWallet = wallet?.provider === 'injected';
  
  // Для встроенных кошельков (Telegram Wallet, injected) — не нужно открывать внешнюю ссылку
  const isEmbeddedWallet = isTelegramWallet || isInjectedWallet;
  
  // ... формирование transaction ...
  
  // Получаем ссылку только для внешних кошельков
  const walletLink = isEmbeddedWallet ? null : getConnectedWalletLink();
  
  // Отправляем транзакцию
  tonConnectUI.sendTransaction(transaction, { ... }).catch(...);
  
  // Открываем кошелёк только если это внешний (http) кошелёк
  if (walletLink) {
    openWalletLink(walletLink);
    toast.success('Открываем кошелёк...');
  } else if (isEmbeddedWallet) {
    // Для Telegram Wallet и injected кошельков — ничего делать не нужно
    // Модальное окно откроется автоматически внутри Telegram
    toast.success('Подтвердите транзакцию в кошельке');
  } else {
    toast.error('Не удалось получить ссылку кошелька. Переподключите кошелёк.');
    setIsPaying(false);
  }
};
```

---

### Файл 2: `src/components/deals/PaymentDialog.tsx`

**Аналогичные изменения** в функции `handlePayViaWallet`:

```typescript
const wallet = tonConnectUI.wallet;

// Telegram Wallet определяется по appName устройства
const isTelegramWallet = wallet?.device?.appName?.toLowerCase().includes('telegram');

// Также проверяем injected как fallback
const isInjectedWallet = wallet?.provider === 'injected';

// Для встроенных кошельков — не открываем внешнюю ссылку
const isEmbeddedWallet = isTelegramWallet || isInjectedWallet;

const walletLink = isEmbeddedWallet ? null : getConnectedWalletLink();
```

---

## Логика после изменений

| Кошелёк | device.appName | provider | Действие |
|---------|----------------|----------|----------|
| Telegram Wallet (@wallet) | `'telegram-wallet'` | `injected` или `http` | НЕ открываем ссылку |
| MyTonWallet (app) | `'mytonwallet'` | `http` | Открываем universalLink |
| Tonkeeper (app) | `'tonkeeper'` | `http` | Открываем universalLink |

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/components/channel/PaymentStep.tsx` | Добавить проверку `device.appName.includes('telegram')` |
| `src/components/deals/PaymentDialog.tsx` | То же самое |

---

## Дополнительно: логирование для отладки

Добавим в лог `device.appName` чтобы видеть, как определяется кошелёк:

```typescript
console.log('[TonConnect] wallet:', wallet);
console.log('[TonConnect] device.appName:', wallet?.device?.appName);
console.log('[TonConnect] provider:', wallet?.provider);
```

