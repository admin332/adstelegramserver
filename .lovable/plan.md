

## Исправление открытия кошелька при оплате

### Проблема

При нажатии "Оплатить" кошелёк не открывается, хотя при подключении через `TonConnectButton` всё работает.

**Причина:** В вызовах `sendTransaction` отсутствуют опции `modals` и `notifications`, которые отвечают за показ модального окна с кнопкой открытия внешнего кошелька.

### Текущее состояние

| Файл | Проблема |
|------|----------|
| `src/main.tsx` | `actionsConfiguration` не содержит `modals`, `notifications`, `skipRedirectToWallet` |
| `src/components/channel/PaymentStep.tsx` | `sendTransaction` имеет только `skipRedirectToWallet`, нет `modals` |
| `src/components/deals/PaymentDialog.tsx` | То же самое |

### URL сайта

Проверено — везде используется правильный URL:
- Манифест: `https://adsingo.online` ✓
- twaReturnUrl: `https://t.me/adsingo_bot/open` ✓

---

## Изменения

### 1. `src/main.tsx` — добавить полную конфигурацию

```typescript
// Строки 14-24 — полная замена

const isTMA = Boolean(window.Telegram?.WebApp?.initData);
const returnStrategy = isTMA ? 'tg://resolve' : 'back';

createRoot(document.getElementById("root")!).render(
  <TonConnectUIProvider 
    manifestUrl={manifestUrl}
    actionsConfiguration={{
      returnStrategy: returnStrategy as 'back' | 'tg://resolve',
      twaReturnUrl: 'https://t.me/adsingo_bot/open',
      modals: ['before', 'success', 'error'],
      notifications: ['before', 'success', 'error'],
      skipRedirectToWallet: 'never',
    }}
  >
    <App />
  </TonConnectUIProvider>
);
```

---

### 2. `src/components/deals/PaymentDialog.tsx` — добавить modals в sendTransaction

```typescript
// Строки 75-88 — изменить опции sendTransaction

await tonConnectUI.sendTransaction(
  {
    validUntil: Math.floor(Date.now() / 1000) + 600,
    messages: [
      {
        address: escrowAddress,
        amount: amountNano,
      },
    ],
  },
  {
    modals: ['before', 'success', 'error'],
    notifications: ['before', 'success', 'error'],
    returnStrategy: window.Telegram?.WebApp?.initData ? 'tg://resolve' : 'back',
    twaReturnUrl: 'https://t.me/adsingo_bot/open',
    skipRedirectToWallet: 'never',
  }
);
```

---

### 3. `src/components/channel/PaymentStep.tsx` — добавить modals в sendTransaction

```typescript
// Строки 67-71 — изменить опции sendTransaction

await tonConnectUI.sendTransaction(transaction, {
  modals: ['before', 'success', 'error'],
  notifications: ['before', 'success', 'error'],
  returnStrategy: window.Telegram?.WebApp?.initData ? 'tg://resolve' : 'back',
  twaReturnUrl: 'https://t.me/adsingo_bot/open',
  skipRedirectToWallet: 'never',
});
```

---

## Что делает каждый параметр

| Параметр | Значение | Эффект |
|----------|----------|--------|
| `modals: ['before', 'success', 'error']` | Показывать модалки | **Главное!** Modal 'before' показывает кнопку для открытия кошелька |
| `notifications: ['before', 'success', 'error']` | Показывать уведомления | Информирует пользователя о статусе |
| `returnStrategy: 'tg://resolve'` | Telegram protocol | Позволяет вернуться в Mini App после подписи |
| `twaReturnUrl` | URL возврата | Ссылка на Mini App |
| `skipRedirectToWallet: 'never'` | Всегда редирект | Принудительное открытие кошелька |

---

## Файлы для изменения

| Файл | Что изменить |
|------|--------------|
| `src/main.tsx` | Добавить `modals`, `notifications`, `skipRedirectToWallet` в actionsConfiguration |
| `src/components/deals/PaymentDialog.tsx` | Добавить полные опции в sendTransaction (строки 85-87) |
| `src/components/channel/PaymentStep.tsx` | Добавить полные опции в sendTransaction (строки 69-71) |

---

## Ожидаемый результат

1. При нажатии "Оплатить" появится модальное окно TonConnect
2. В модальном окне будет кнопка "Открыть кошелёк" / "Open wallet"
3. При клике на кнопку откроется MyTonWallet/Tonkeeper
4. После подписи пользователь вернётся в Mini App
5. Поведение станет идентичным подключению кошелька

