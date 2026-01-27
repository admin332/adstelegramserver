# Текущие задачи

## ✅ Завершено: Авто-возврат просроченных сделок

Реализовано автоматическое отклонение неодобренных escrow сделок с возвратом средств.

### Что сделано:
1. **Edge Function `auto-refund-expired-deals`** — проверяет сделки в статусе `escrow` где `scheduled_at < NOW()`
2. **Cron Job** — запускается каждый час в :30 минут
3. **Миграция БД** — добавлена колонка `cancellation_reason`

### Логика возврата:
- Расшифровка мнемоники эскроу-кошелька (AES-256-GCM)
- Отправка TON на `wallet_address` рекламодателя
- Статус сделки → `cancelled`, причина → `auto_expired`
- Уведомления обеим сторонам в Telegram

### Жизненный цикл сделки:
```
pending → escrow → in_progress → completed
   ↓         ↓
expired  cancelled
(20мин)  (scheduled_at прошёл без одобрения)
         + auto refund
```
