

## Проблема

Уведомление показывает неправильное время публикации: `00:00` вместо `02:00`.

### Причина

Edge function `notify-deal-payment` форматирует дату с помощью стандартных методов JavaScript (`getHours()`, `getDate()`), которые работают в часовом поясе сервера (**UTC**).

Цепочка событий:
1. Пользователь выбирает 02:00 в часовом поясе UTC+2
2. JavaScript конвертирует в UTC: `2026-01-27T00:00:00.000Z`
3. База данных хранит UTC: `2026-01-27 00:00:00+00`
4. Edge function читает и форматирует в UTC → показывает `00:00`
5. Но пользователь ожидает увидеть `02:00` (его локальное время)

### Текущий код (строки 151-163 в notify-deal-payment/index.ts)
```typescript
function formatDate(dateStr: string | null): string {
  const date = new Date(dateStr);
  const hours = date.getHours(); // <-- UTC время сервера!
  return `${day}.${month}.${year} в ${hours}:${minutes}`;
}
```

## Решение

Хранить и отображать время в часовом поясе пользователя. Есть два варианта:

### Вариант А: Хранить часовой пояс пользователя (рекомендуется)
Сохранять `timezone` пользователя при создании сделки и использовать его для форматирования.

### Вариант Б: Форматировать в фиксированном часовом поясе (быстрое решение)
Для русскоязычного приложения использовать Московское время (UTC+3).

## План реализации (Вариант Б — быстрое решение)

### 1. Обновить `notify-deal-payment/index.ts`

Заменить функцию `formatDate()` на версию с явным часовым поясом:

```typescript
// Format date in Moscow timezone (UTC+3)
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "По согласованию";
  
  const date = new Date(dateStr);
  
  // Форматируем в московском часовом поясе
  const formatter = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(date);
  const day = parts.find(p => p.type === 'day')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const year = parts.find(p => p.type === 'year')?.value;
  const hour = parts.find(p => p.type === 'hour')?.value;
  const minute = parts.find(p => p.type === 'minute')?.value;
  
  return `${day}.${month}.${year} в ${hour}:${minute}`;
}
```

### 2. Также обновить `check-escrow-payments/index.ts`

Та же функция `formatDate()` используется в `check-escrow-payments`. Нужно синхронизировать изменения.

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `supabase/functions/notify-deal-payment/index.ts` | Обновить `formatDate()` |
| `supabase/functions/check-escrow-payments/index.ts` | Обновить `formatDate()` |

## Результат

После изменения:
- UTC время `2026-01-27T00:00:00Z` будет отображаться как `27.01.2026 в 03:00` (по Москве)
- Время будет корректно отображаться для пользователей в московском часовом поясе

## Примечание для будущего улучшения

Для точного отображения времени в часовом поясе каждого пользователя потребуется:
1. Добавить поле `timezone` в таблицу `users`
2. Получать часовой пояс из Telegram Mini App (`Telegram.WebApp.initDataUnsafe.user`)
3. Передавать timezone в edge functions

