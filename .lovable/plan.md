

## Исправление TonConnect для внешних кошельков (MyTonWallet, Tonkeeper)

---

## Проблема

Сейчас в `main.tsx`:

```typescript
<TonConnectUIProvider manifestUrl={manifestUrl}>
  <App />
</TonConnectUIProvider>
```

Отсутствует `actionsConfiguration`, поэтому:
- Wallet (встроенный в Telegram) работает — он внутренний
- MyTonWallet / Tonkeeper не работают — SDK не знает как вернуть пользователя обратно в Mini App

---

## Решение

Добавить `actionsConfiguration` с двумя параметрами:
- `returnStrategy: 'back'` — для обычных внешних кошельков
- `twaReturnUrl` — для возврата в Telegram Mini App

---

## Изменения

### `src/main.tsx`

```typescript
import { createRoot } from "react-dom/client";
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import App from "./App.tsx";
import "./index.css";

const manifestUrl = `${window.location.origin}/tonconnect-manifest.json`;

createRoot(document.getElementById("root")!).render(
  <TonConnectUIProvider 
    manifestUrl={manifestUrl}
    actionsConfiguration={{
      // Для обычных браузеров - вернуться назад
      returnStrategy: 'back',
      // Для Telegram Mini Apps - вернуться в бота
      twaReturnUrl: 'https://t.me/AdsingoBot'
    }}
  >
    <App />
  </TonConnectUIProvider>
);
```

---

## Как это работает

| Сценарий | returnStrategy | Поведение |
|----------|----------------|-----------|
| TMA + Wallet (встроенный) | игнорируется | Работает нативно внутри Telegram |
| TMA + MyTonWallet | `twaReturnUrl` | Открывает MyTonWallet → после подписания возвращает в t.me/AdsingoBot |
| Браузер + Tonkeeper | `returnStrategy: 'back'` | Открывает Tonkeeper → после подписания возвращает назад |

---

## Альтернатива: динамическая настройка

Если нужно более точное управление:

```typescript
// Определяем, в Telegram ли мы
const isTMA = window.Telegram?.WebApp?.initData;

const actionsConfig = {
  returnStrategy: isTMA ? 'tg://resolve' : 'back',
  twaReturnUrl: 'https://t.me/AdsingoBot'
};
```

Но базовой настройки с `'back'` и `twaReturnUrl` должно хватить для большинства случаев.

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/main.tsx` | Добавить `actionsConfiguration` с `returnStrategy` и `twaReturnUrl` |

---

## Результат

- MyTonWallet откроется и после подписания транзакции вернёт пользователя в приложение
- Tonkeeper будет работать аналогично
- Встроенный Wallet продолжит работать как раньше

