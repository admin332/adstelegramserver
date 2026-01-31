

## Исправление TonConnect для MyTonWallet — правильный twaReturnUrl и manifest

---

## Найденная причина

| Проблема | Сейчас | Должно быть |
|----------|--------|-------------|
| **twaReturnUrl** | `https://t.me/AdsingoBot/app` | `https://t.me/adsingo_bot/open` |
| **terms page** | 404 | Рабочая страница или убрать из manifest |
| **privacy page** | 404 | Рабочая страница или убрать из manifest |

MyTonWallet после подписи транзакции пытается вернуть пользователя на указанный `twaReturnUrl`. Если ссылка неправильная — возврат не работает и SDK выбрасывает ошибку.

---

## Изменения

### 1. `src/main.tsx` — исправить twaReturnUrl

```typescript
// Было:
twaReturnUrl: 'https://t.me/AdsingoBot/app'

// Станет:
twaReturnUrl: 'https://t.me/adsingo_bot/open'
```

---

### 2. `public/tonconnect-manifest.json` — убрать несуществующие ссылки

**Вариант А: Убрать поля terms/privacy (если нет страниц)**

```json
{
  "url": "https://adsingo.online",
  "name": "Adsingo",
  "iconUrl": "https://adsingo.online/icon.png"
}
```

**Вариант Б: Создать заглушки для /terms и /privacy**

Если нужно оставить эти поля — можно создать простые страницы-заглушки.

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/main.tsx` | Изменить `twaReturnUrl` на `https://t.me/adsingo_bot/open` |
| `public/tonconnect-manifest.json` | Убрать `termsOfUseUrl` и `privacyPolicyUrl` |

---

## Ожидаемый результат

1. После подписи в MyTonWallet пользователь вернётся в правильный Mini App
2. Не будет ошибок из-за недоступных страниц в манифесте
3. ton_connect_sdk_error должен исчезнуть

