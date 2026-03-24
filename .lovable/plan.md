

# Отключение всех Cron Jobs

## Что сделаем
Вызовем Edge Function `manage-cron-admin` с действием `toggle_all` и `active: false`, чтобы отключить все 6 cron-задач:

- check-escrow-payments
- publish-scheduled-posts
- auto-refund-expired-deals
- complete-posted-deals
- verify-post-integrity
- auto-timeout-deals

## Как
Один вызов к существующей функции `manage-cron-admin` с телом:
```json
{ "action": "toggle_all", "active": false }
```

## Изменения в коде
Никаких изменений в коде не требуется — только вызов существующей функции.

