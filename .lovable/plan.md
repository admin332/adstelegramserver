

## Цель
Установить загруженный логотип как иконку в манифесте TON Connect

## Шаги реализации

### Шаг 1: Скопировать изображение в public/

```
user-uploads://logosvg1.png → public/icon.png
```

Файл будет доступен по адресу `https://adsingo.online/icon.png`

### Шаг 2: Обновить манифест

**Файл**: `public/tonconnect-manifest.json`

```json
{
  "url": "https://adsingo.online",
  "name": "Adsingo",
  "iconUrl": "https://adsingo.online/icon.png",
  "termsOfUseUrl": "https://adsingo.online/terms",
  "privacyPolicyUrl": "https://adsingo.online/privacy"
}
```

Изменение: `favicon.ico` → `icon.png`

## Результат

TON кошельки (Tonkeeper, TON Wallet и др.) будут отображать ваш логотип с мегафоном при подключении к приложению.

