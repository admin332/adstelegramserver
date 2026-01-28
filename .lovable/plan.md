
# Реальные данные статистики на главной странице

## Текущая проблема

В блоках статистики на главной странице показываются захардкоженные значения:
- **Каналов**: "2,450" (реально: 2)
- **Подписчиков**: "22M" (реально: 5)

## Решение

Использовать уже загружаемые данные из `useChannels()` для расчёта реальной статистики.

## Логика расчёта

```text
channels (из useChannels)
    │
    ├── Количество каналов = channels.length
    │
    └── Всего подписчиков = SUM(channel.subscribers)
```

## Изменения

**Файл:** `src/pages/Index.tsx`

### 1. Добавить вычисление статистики

После строки 29 добавить:

```tsx
// Вычисляем статистику из реальных данных
const totalChannels = channels.length;
const totalSubscribers = channels.reduce((sum, ch) => sum + ch.subscribers, 0);

// Форматирование больших чисел
const formatNumber = (num: number): string => {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
};
```

### 2. Обновить StatsCard

Заменить строки 115-126:

```tsx
{/* Было */}
<StatsCard
  icon={<Users className="w-5 h-5" />}
  label="Каналов"
  value="2,450"
  trend={12}
/>
<StatsCard
  icon={<TrendingUp className="w-5 h-5" />}
  label="Подписчиков"
  value="22M"
  trend={5}
/>

{/* Станет */}
<StatsCard
  icon={<Users className="w-5 h-5" />}
  label="Каналов"
  value={isLoading ? "..." : formatNumber(totalChannels)}
/>
<StatsCard
  icon={<TrendingUp className="w-5 h-5" />}
  label="Подписчиков"
  value={isLoading ? "..." : formatNumber(totalSubscribers)}
/>
```

## Что изменится

| Поле | Было | Станет |
|------|------|--------|
| Каналов | "2,450" | Реальное количество (сейчас: 2) |
| Подписчиков | "22M" | Сумма подписчиков (сейчас: 5) |
| Trend | +12% / +5% | Убрать (нет исторических данных) |
| При загрузке | Статические данные | "..." |

## Форматирование чисел

| Диапазон | Формат | Пример |
|----------|--------|--------|
| < 1,000 | Как есть | 5, 42, 999 |
| 1K - 999K | X.XK | 1.5K, 22.3K |
| >= 1M | X.XM | 1.2M, 22.0M |

## Примечание по trend

Убираем показатель trend (процент роста), так как:
1. Нет исторических данных для расчёта
2. Можно добавить позже, если потребуется аналитика по времени
