
# План: Увеличение таймаута оплаты до 1 часа и снижение частоты cron до 5 минут

## Обзор изменений

Изменение лимита времени на оплату с 20 минут до 1 часа и снижение частоты проверки платежей с каждой минуты до каждых 5 минут.

## Шаги реализации

### 1. Изменить cron job `check-escrow-payments`

Текущий schedule: `* * * * *` (каждую минуту)
Новый schedule: `*/5 * * * *` (каждые 5 минут)

```text
SQL запрос для обновления:
UPDATE cron.job 
SET schedule = '*/5 * * * *' 
WHERE jobid = 1;
```

### 2. Изменить таймаут оплаты в Edge Function

**Файл:** `supabase/functions/create-deal/index.ts`

Изменить строку 185:
```typescript
// Было:
const expiresAt = new Date(Date.now() + 20 * 60 * 1000); // +20 minutes

// Станет:
const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // +60 minutes (1 hour)
```

### 3. Обновить формат таймера для часового отсчёта

**Файл:** `src/components/deals/ExpirationTimer.tsx`

Текущий формат показывает только минуты и секунды (`мм:сс`). Для часового таймера нужно добавить часы:

```typescript
// Было:
const mins = Math.floor(diff / 60000);
const secs = Math.floor((diff % 60000) / 1000);
setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);

// Станет:
const hours = Math.floor(diff / 3600000);
const mins = Math.floor((diff % 3600000) / 60000);
const secs = Math.floor((diff % 60000) / 1000);

if (hours > 0) {
  setTimeLeft(`${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
} else {
  setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
}
```

## Влияние на систему

| Параметр | Было | Станет |
|----------|------|--------|
| Частота проверки оплат | 1 мин | 5 мин |
| Время на оплату | 20 мин | 60 мин |
| Формат таймера | `мм:сс` | `чч:мм:сс` / `мм:сс` |

## Технические детали

### Изменяемые файлы:
1. **База данных** — SQL запрос для обновления schedule cron.job
2. **`supabase/functions/create-deal/index.ts`** — константа таймаута
3. **`src/components/deals/ExpirationTimer.tsx`** — логика форматирования времени

### Важные замечания:
- Максимальная задержка обнаружения платежа увеличится с 1 до 5 минут
- Существующие сделки со старым 20-минутным таймаутом продолжат работать по старой логике до истечения
- Новые сделки будут создаваться с часовым лимитом сразу после деплоя
