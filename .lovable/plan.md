

# Деплой недостающих Edge Functions

## Проблема
Функция `channel-team` (команда канала / менеджеры) не задеплоена на сервере. При попытке загрузить список менеджеров канала запрос возвращает 404. Логи пусты — функция просто отсутствует в удалённом окружении.

Это повторяющаяся проблема: при предыдущих деплоях часть функций "терялась" и требовала ручного повторного деплоя.

## Решение

Задеплоить **все** Edge Functions из проекта одной командой, чтобы гарантировать что ни одна функция не отсутствует:

- `channel-team` (основная проблема — команда канала)
- И все остальные функции для предотвращения подобных проблем в будущем

## Список функций для деплоя (39 штук)

| Группа | Функции |
|--------|---------|
| Авторизация | telegram-auth |
| Каналы | verify-channel, user-channels, channel-team, channel-stats-for-owner, refresh-channel-stats, update-channel-settings, update-channel-status, detect-bot-channels, preview-channel |
| Команда | join-channel-as-admin, recheck-admin-status |
| Сделки | create-deal, deal-action, user-deals, notify-deal-payment, check-escrow-payments, submit-draft, review-draft |
| Автоматизация | publish-scheduled-posts, auto-refund-expired-deals, complete-posted-deals, verify-post-integrity, auto-timeout-deals |
| Кампании | create-campaign, update-campaign, delete-campaign, send-campaign-preview, upload-campaign-media, check-campaign-deals |
| Прочее | save-wallet, ton-price, toggle-favorite, manage-cron-admin, user-advertiser-stats, telegram-webhook, mtproto-channel-stats, admin-complete-deal, admin-cancel-deal |

## Результат
- Команда канала (менеджеры) снова загружается
- Все функции гарантированно доступны на сервере
- Не потребуется повторно деплоить отдельные функции

## Изменения в коде
Никаких изменений в коде не требуется — только деплой существующих функций.
