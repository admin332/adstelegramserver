
Цель: сделать «открытие кошелька» надёжным в Telegram Mini App (TMA) для MyTonWallet, без «before»-модалки TonConnect, и объяснить почему “просто ссылка” сейчас не открывается.

## Почему сейчас «перенаправляем… и ничего»
По текущему коду в `PaymentStep.tsx` / `PaymentDialog.tsx` есть две ключевые причины, из‑за которых в TMA может не открываться кошелёк:

1) **Мы открываем ссылку после `await tonConnectUI.getWallets()`**
   - В WebView/Telegram действия открытия внешних ссылок часто **должны происходить строго в рамках пользовательского клика**.
   - Любой `await` перед открытием ссылки может “снять” user-gesture контекст, и Telegram/OS молча блокирует переход.

2) **Используется `Telegram.WebApp.openTelegramLink(link)` для НЕ-telegram ссылок**
   - `openTelegramLink` предназначен для `t.me/...`/`tg://...`
   - Universal Link кошелька (MyTonWallet/Tonkeeper) обычно **внешний https-url**, и Telegram может его не открыть через `openTelegramLink`, поэтому визуально “ничего”.

Дополнительно ухудшает UX то, что мы показываем toast “Перенаправляем…” даже если ссылку так и не удалось получить/открыть.

## Что сделаем (исправление «как для людей»)
### Главный принцип
- **Никаких await до открытия кошелька.**
- Универсальную ссылку кошелька получаем **синхронно** из `tonConnectUI.wallet` (там есть wallet info для подключённого кошелька).
- Для TMA используем **`Telegram.WebApp.openLink()`** (а не openTelegramLink) для внешних URL.
- Если Telegram API недоступен — fallback на `window.location.href = link`.

### Где правим
1) `src/components/channel/PaymentStep.tsx`
2) `src/components/deals/PaymentDialog.tsx`

(Типы в `src/lib/telegram.ts` уже содержат `openLink`, менять их, скорее всего, не нужно.)

---

## Точный план правок

### A) Добавить безопасный helper (локально в каждом компоненте или вынести позже)
Внутри каждого компонента создаём функцию (можно прямо над `handlePayViaWallet`):

- `getConnectedWalletUniversalLink()`:
  - Считывает `const wallet = tonConnectUI.wallet`
  - Берёт `const link = (wallet as any)?.universalLink`
  - (Опционально: если universalLink отсутствует, показать пользователю понятное сообщение)

- `openWalletLink(link: string)`:
  - Если `window.Telegram?.WebApp?.openLink` есть — `window.Telegram.WebApp.openLink(link)`
  - Иначе `window.location.href = link`

Важно: **никаких await внутри этих функций.**

### B) Переписать `handlePayViaWallet` так, чтобы ссылка открывалась строго в момент клика
Текущая проблема: мы ждём `getWallets()`, а потом пытаемся открыть.
Исправляем порядок:

1) Сформировать `transaction`
2) Синхронно достать `link` из `tonConnectUI.wallet` (без await)
3) Вызвать `tonConnectUI.sendTransaction(...)` (можно без await, как сейчас)
4) Сразу вызвать `openWalletLink(link)` (в этой же синхронной цепочке клика)
5) Toast показывать:
   - Если `link` найден и мы вызвали openLink/location.href — можно показать “Открываем кошелёк…”
   - Если `link` не найден — показать ошибку “Не удалось получить ссылку кошелька. Переподключите кошелёк.”

Также:
- Toast “Перенаправляем…” показывать **только когда реально есть link и мы реально делаем попытку открытия**.
- Если `link` отсутствует — не обещать пользователю редирект.

### C) Оставить modals без `before`, как в Plan B
Сохраняем:
- `modals: ['success', 'error']`
- `notifications: ['before', 'success', 'error']` (можно оставить, но если мешает — обсудим)
- `returnStrategy: 'tg://resolve'`
- `twaReturnUrl: 'https://t.me/adsingo_bot/open'`

### D) (Опционально, но желательно) добавить “Fallback: открыть ссылку вручную”
Чтобы полностью закрыть кейсы, когда Telegram/OS всё равно блокирует:
- Если `link` есть, но переход не случился (мы не можем 100% детектнуть), можно показать под кнопкой оплаты вторую кнопку:
  - “Открыть кошелёк вручную”
  - которая просто вызывает `openWalletLink(link)` ещё раз
  - или выводит сам link (копируемый) — “Скопировать ссылку кошелька”

Это сильно снижает “бесит, ничего не происходит”.

---

## Проверка после изменений (обязательно)
1) В Telegram Mini App (реально внутри Telegram, не preview), с подключённым **MyTonWallet**:
   - Нажать “Оплатить”
   - Ожидаем: появляется системный prompt/или сразу открывается MyTonWallet (в зависимости от платформы)
2) Проверить в iOS и Android (если доступно):
   - На iOS чаще нужен системный prompt — это норм
3) Если не открылось:
   - Сразу открыть “Открыть кошелёк вручную” (fallback) — должно сработать
4) Посмотреть консоль в TMA (если есть возможность) на предмет ошибок TonConnect.

---

## Почему «обычная ссылка» не всегда открывается в TMA
Даже “обычная ссылка” в Telegram Mini App:
- может быть заблокирована, если она открывается не в рамках user gesture (клика),
- может не открыться, если использовать неподходящий API (`openTelegramLink` вместо `openLink`),
- иногда Telegram требует именно свой метод `openLink`, а не `window.open`.

Мы сделаем поведение максимально похожим на connect: “клик → сразу openLink → кошелёк открывается”.

---

## Затрагиваемые файлы
- `src/components/channel/PaymentStep.tsx` — убрать `await getWallets()` из клика, заменить на sync `tonConnectUI.wallet?.universalLink`, использовать `Telegram.WebApp.openLink`
- `src/components/deals/PaymentDialog.tsx` — то же самое

