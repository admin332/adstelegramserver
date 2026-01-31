
## Исправление ton_connect_sdk_error / tonconnectuierror для MyTonWallet в Telegram (моб.) на adsingo.online

### Что происходит сейчас (по симптомам)
- Встроенный Telegram Wallet открывается и работает, потому что он “внутри Telegram”.
- MyTonWallet — внешний кошелёк. Для него TonConnect должен:
  1) корректно открывать внешнее приложение из Telegram WebView,
  2) иметь корректную стратегию возврата обратно в Mini App,
  3) не попадать под ограничения iOS/Telegram на universal links/редиректы,
  4) не падать из‑за “тихой” ошибки SDK без видимого сообщения.

Сейчас `actionsConfiguration` уже добавлен, но:
- `returnStrategy: 'back'` часто недостаточно именно для Telegram Mini Apps (особенно для внешних кошельков).
- Мы не выводим в UI понятную причину ошибки (чаще всего у TonConnect есть `message`/`code`, но сейчас оно теряется).

---

## Цель
Сделать так, чтобы при оплате через MyTonWallet в Telegram (моб.) транзакция:
- открывала MyTonWallet,
- не падала с ton_connect_sdk_error,
- в случае отказа/ошибки показывала человеку понятный текст (а нам — полезные логи),
- корректно возвращала пользователя в Telegram Mini App после подписи/отмены.

---

## План изменений (без “угадываний”, только то, что реально влияет)

### 1) Сделать `actionsConfiguration` динамическим для Telegram Mini App
**Файл:** `src/main.tsx`

**Идея:**
- Если мы внутри Telegram Mini App — используем `returnStrategy: 'tg://resolve'` (это чаще всего именно то, что нужно Telegram для внешних кошельков).
- Если не в Telegram — оставляем `returnStrategy: 'back'`.
- `twaReturnUrl` делаем более “возвратным”: не просто на бота, а на ссылку открытия Mini App (если есть startapp-параметр, добавляем его).

**Что именно делаем:**
- Определяем `isTMA` через `window.Telegram?.WebApp?.initData` (или через ваш `isTelegramMiniApp()` из `src/lib/telegram.ts`).
- Собираем `twaReturnUrl`:
  - базово: `https://t.me/AdsingoBot`
  - если у вас Mini App запускается через `startapp`, то формируем `https://t.me/AdsingoBot?startapp=<param>` (или тот формат, который вы используете для открытия Mini App).
  - если `startapp` параметр взять неоткуда — оставляем просто `https://t.me/AdsingoBot` (хуже, но безопасно).

Ожидаемый эффект: TonConnect начнёт использовать “телеграмный” механизм возврата вместо обычного браузерного “назад”.

---

### 2) Принудить корректное открытие внешнего кошелька на iOS/Telegram (skipRedirectToWallet)
**Файлы:**
- `src/components/channel/PaymentStep.tsx`
- `src/components/deals/PaymentDialog.tsx`

**Идея:**
TonConnect UI по умолчанию на iOS может “не редиректить” в кошелек после `sendTransaction` из-за ограничений universal links. В Telegram WebView это иногда проявляется как `TON_CONNECT_SDK_ERROR`, потому что редирект/открытие отклоняется.

**Что делаем:**
- В вызовах `tonConnectUI.sendTransaction(...)` добавляем 2-й параметр options:
  - `skipRedirectToWallet: 'never'` (то есть “никогда не пропускай редирект в кошелек”, принудительно пытайся открыть кошелек).
  - (Опционально) включаем модалки/нотификации, чтобы UI TonConnect показывал стадии (before/success/error). Это помогает диагностике.

Ожидаемый эффект: уменьшение случаев, когда Telegram/iOS “съедает” открытие MyTonWallet и SDK падает.

---

### 3) Нормальная диагностика: показывать пользователю причину, а нам — полный объект ошибки
**Файлы:**
- `src/components/channel/PaymentStep.tsx`
- `src/components/deals/PaymentDialog.tsx`

**Проблема сейчас:**
В `PaymentStep.tsx` ошибка просто `console.error`, без toast — пользователь видит “что-то сломалось”.
В `PaymentDialog.tsx` есть toast, но он может не показывать ключевые поля ошибки (code/name).

**Что делаем:**
- В `catch`:
  - логируем `console.error('[TonConnect] sendTransaction error', error, JSON.stringify(error))`
  - показываем toast с максимально полезной и короткой причиной:
    - `error?.message` если есть
    - иначе “Не удалось открыть MyTonWallet. Попробуйте ещё раз.”
- Отдельно обрабатываем “Interrupted” (cancel) как “Оплата отменена”, чтобы не путать с багом.

Ожидаемый эффект: вы сразу увидите, это проблема “редирект/ссылка”, “bridge timeout”, “manifest”, “wallet not supported”, “user cancelled”.

---

### 4) Проверка манифеста и домена (без изменения логики оплаты, но критично для внешних кошельков)
**Файл:** `public/tonconnect-manifest.json`

У вас сейчас:
- `"url": "https://adsingo.online"` и другие ссылки на adsingo.online — это правильно, если приложение реально всегда работает на adsingo.online и HTTPS корректный.

**Что делаем в рамках кода (быстрая самопроверка):**
- При старте приложения (например, в `App.tsx` или отдельном init-файле) делаем `fetch('/tonconnect-manifest.json')` и:
  - если статус не 200 или JSON не парсится — логируем это как критичную проблему.
  - показываем понятное сообщение (только в dev/тестовом режиме), что манифест недоступен.
  
Ожидаемый эффект: если проблема на стороне отдачи манифеста/SSL/редиректов домена — вы это увидите мгновенно, а не “в виде ton_connect_sdk_error”.

---

## Как будем тестировать (обязательно, иначе невозможно подтвердить фикс)
1) Telegram (моб.) → adsingo.online → подключить MyTonWallet
2) Нажать “Оплатить”
3) Ожидаемое поведение:
   - открывается MyTonWallet
   - после подтверждения/отмены — возврат в Telegram
   - нет ton_connect_sdk_error
4) Если ошибка всё равно будет — благодаря шагу (3) у нас будет точный текст/код ошибки и можно будет прицельно исправлять (например, если это окажется bridge timeout или проблема deeplink формата).

---

## Список точечных правок по файлам
1) `src/main.tsx`
   - сделать `actionsConfiguration` динамическим:
     - Telegram Mini App: `returnStrategy: 'tg://resolve'`
     - вне Telegram: `returnStrategy: 'back'`
   - улучшить `twaReturnUrl` (по возможности добавив startapp)
2) `src/components/channel/PaymentStep.tsx`
   - добавить options в `sendTransaction` (skipRedirectToWallet)
   - показать toast на ошибку + расширенный лог
3) `src/components/deals/PaymentDialog.tsx`
   - добавить options в `sendTransaction` (skipRedirectToWallet)
   - улучшить обработку/логирование ошибки
4) (Опционально, но рекомендовано) `App.tsx` или общий init
   - runtime-check: fetch `/tonconnect-manifest.json` и логировать проблему, если файл недоступен

---

## Важное замечание
Если после этих изменений ошибка останется, с высокой вероятностью причина будет уже не “возврат/редирект”, а конкретно:
- bridge connection timeout (кошелёк не отвечает через мост),
- блокировка открытия внешних ссылок в конкретной связке Telegram/iOS,
- неверный deep link возврата именно для вашего Mini App (нужен точный формат startapp).

Но после внедрения диагностики мы будем видеть точную причину, а не общий `TON_CONNECT_SDK_ERROR`.
