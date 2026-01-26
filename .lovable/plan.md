

## Цель
Обновить манифест TON Connect с продакшен доменом `adsingo.online`

## Текущий файл

**Файл**: `public/tonconnect-manifest.json`

```json
{
  "url": "https://adstelegramserver.lovable.app",
  "name": "Adsingo",
  "iconUrl": "https://adstelegramserver.lovable.app/favicon.ico",
  "termsOfUseUrl": "https://adstelegramserver.lovable.app/terms",
  "privacyPolicyUrl": "https://adstelegramserver.lovable.app/privacy"
}
```

## Изменения

Заменить все URL на продакшен домен:

```json
{
  "url": "https://adsingo.online",
  "name": "Adsingo",
  "iconUrl": "https://adsingo.online/icon.png",
  "termsOfUseUrl": "https://adsingo.online/terms",
  "privacyPolicyUrl": "https://adsingo.online/privacy"
}
```

## Важно

Убедитесь, что файл `icon.png` существует в папке `public/` — иначе TON кошельки не смогут отобразить иконку приложения. Если иконки нет, нужно будет её добавить или использовать существующий `favicon.ico`:

```json
"iconUrl": "https://adsingo.online/favicon.ico"
```

