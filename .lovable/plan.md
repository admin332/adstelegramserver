
## Пропуск внешнего редиректа для встроенного кошелька Telegram (@wallet)

### Проблема
Сейчас при оплате через @wallet (встроенный кошелёк Telegram) код пытается открыть внешнюю ссылку, хотя это не нужно — @wallet работает прямо внутри Telegram через JS Bridge.

### Как определить встроенный кошелёк

Согласно типам TonConnect SDK:
- `wallet.provider === 'injected'` — кошелёк работает через JS Bridge (встроен)
- `wallet.provider === 'http'` — кошелёк работает через HTTP Bridge (внешнее приложение)

Для @wallet (Telegram Wallet):
- `provider = 'injected'`
- `device.appName = 'telegram-wallet'`

### План изменений

#### 1. `src/components/channel/PaymentStep.tsx`

Добавить проверку перед попыткой открыть внешнюю ссылку:

```typescript
const handlePayViaWallet = () => {
  // ... формирование transaction ...
  
  const wallet = tonConnectUI.wallet;
  
  // Проверяем, это injected кошелёк (встроенный, например @wallet)?
  const isInjectedWallet = wallet?.provider === 'injected';
  
  // Получаем ссылку только для http-кошельков
  const walletLink = isInjectedWallet ? null : getConnectedWalletLink();
  
  // Отправляем транзакцию
  tonConnectUI.sendTransaction(transaction, { ... }).catch(...);
  
  // Открываем кошелёк только если это внешний (http) кошелёк
  if (walletLink) {
    openWalletLink(walletLink);
    toast.success('Открываем кошелёк...');
  } else if (isInjectedWallet) {
    // Для injected кошелька (@wallet) ничего делать не нужно
    // Модальное окно откроется автоматически внутри Telegram
    toast.success('Подтвердите транзакцию в кошельке');
  } else {
    toast.error('Не удалось получить ссылку кошелька...');
    setIsPaying(false);
  }
};
```

#### 2. `src/components/deals/PaymentDialog.tsx`

Аналогичные изменения:
- Добавить проверку `wallet?.provider === 'injected'`
- Для injected кошельков не вызывать `openWalletLink`
- Показать другой toast: "Подтвердите транзакцию в кошельке"

---

### Логика работы после изменений

| Кошелёк | provider | Действие |
|---------|----------|----------|
| @wallet (Telegram) | `injected` | Не открываем ссылку, показываем "Подтвердите транзакцию" |
| MyTonWallet (app) | `http` | Открываем universalLink через `openLink()` |
| Tonkeeper (app) | `http` | Открываем universalLink через `openLink()` |

---

### Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/components/channel/PaymentStep.tsx` | Добавить проверку `provider === 'injected'`, пропустить редирект для встроенных кошельков |
| `src/components/deals/PaymentDialog.tsx` | То же самое |
