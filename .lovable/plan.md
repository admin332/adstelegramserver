

## Исправление расчёта минимального времени до публикации

Логика расчёта доступных слотов для будущих дней неправильно считает время от начала дня, а не от текущего момента.

---

## Проблема

| Параметр | Значение |
|----------|----------|
| Текущее время | ~20:00, 30 января |
| `minHoursBeforePost` | 10 часов |
| Выбранная дата | 31 января |

**Неправильный расчёт:**
```text
daysDiff = 1 (следующий день)
hoursAlreadyCovered = 24 часа  ← Неверно! До полуночи осталось только ~4 часа
remainingMinHours = 10 - 24 = -14
→ Все слоты доступны с 00:00 (через ~4 часа)
```

**Правильный расчёт:**
```text
Сейчас 20:00, нужно +10 часов = минимум 06:00 следующего дня
→ Слоты должны быть доступны только с 06:00
```

---

## Решение

Нужно считать абсолютное время от текущего момента, а не относительно начала дня.

---

## Файл: `src/components/channel/DateTimeSelector.tsx`

**Заменить функцию `getAvailableHours()` (строки 47-70):**

```typescript
const getAvailableHours = () => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  
  // Минимальный час = текущий час + minHoursBeforePost (минимум 2)
  const minTotalHours = Math.max(2, minHoursBeforePost);
  
  // Рассчитываем абсолютное время минимальной публикации
  const minPublishTime = new Date(now.getTime() + minTotalHours * 60 * 60 * 1000);
  
  // Получаем начало выбранного дня
  const selectedDayStart = new Date(selectedDate);
  selectedDayStart.setHours(0, 0, 0, 0);
  
  // Получаем начало сегодняшнего дня
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  
  // Если выбранный день раньше минимальной даты публикации
  if (selectedDayStart < new Date(minPublishTime).setHours(0, 0, 0, 0)) {
    // Это сегодня - фильтруем часы
    if (selectedDayStart.getTime() === todayStart.getTime()) {
      const minHour = minPublishTime.getHours();
      // Если есть минуты, нужно округлить вверх до следующего часа
      const adjustedMinHour = currentMinutes > 0 
        ? Math.ceil((currentHour + minTotalHours)) 
        : currentHour + minTotalHours;
      return hours.filter(hour => hour >= adjustedMinHour);
    }
    return []; // День недоступен
  }
  
  // Проверяем, попадает ли минимальное время публикации на выбранный день
  const minPublishDayStart = new Date(minPublishTime);
  minPublishDayStart.setHours(0, 0, 0, 0);
  
  if (selectedDayStart.getTime() === minPublishDayStart.getTime()) {
    // Выбранный день = день минимальной публикации
    // Фильтруем часы, которые раньше минимального времени
    const minHour = minPublishTime.getHours();
    const adjustedMinHour = minPublishTime.getMinutes() > 0 ? minHour + 1 : minHour;
    return hours.filter(hour => hour >= adjustedMinHour);
  }
  
  // Выбранный день позже минимального - все часы доступны
  return hours;
};
```

---

## Визуальный пример

**Сейчас: 20:00, 30 января | minHoursBeforePost = 10**

| Выбранная дата | Доступные слоты |
|----------------|-----------------|
| 30 января (сегодня) | Нет слотов (20 + 10 = 30 > 24) |
| 31 января | С 06:00 (20 + 10 = 30 → 06:00 следующего дня) |
| 1 февраля | Все слоты (00:00 - 23:00) |

---

## Дополнительно: OrderDrawer.tsx

**Обновить инициализацию `selectedHour` (строки 50-55):**

Нужно также правильно инициализировать начальный час с учётом выбранной даты:

```typescript
const [selectedHour, setSelectedHour] = useState(() => {
  const now = new Date();
  const minTotalHours = Math.max(2, minHoursBeforePost);
  const minPublishTime = new Date(now.getTime() + minTotalHours * 60 * 60 * 1000);
  
  // Если минимальное время публикации сегодня
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  
  if (minPublishTime <= todayEnd) {
    return minPublishTime.getMinutes() > 0 
      ? minPublishTime.getHours() + 1 
      : minPublishTime.getHours();
  }
  
  // Иначе возвращаем час из минимального времени публикации
  return minPublishTime.getMinutes() > 0 
    ? minPublishTime.getHours() + 1 
    : minPublishTime.getHours();
});
```

**Обновить `handleDateChange` (строки 176-185):**

```typescript
const handleDateChange = (date: Date) => {
  setSelectedDate(date);
  
  const now = new Date();
  const minTotalHours = Math.max(2, minHoursBeforePost);
  const minPublishTime = new Date(now.getTime() + minTotalHours * 60 * 60 * 1000);
  
  const selectedDayStart = new Date(date);
  selectedDayStart.setHours(0, 0, 0, 0);
  
  const minPublishDayStart = new Date(minPublishTime);
  minPublishDayStart.setHours(0, 0, 0, 0);
  
  if (selectedDayStart.getTime() === minPublishDayStart.getTime()) {
    const minHour = minPublishTime.getMinutes() > 0 
      ? minPublishTime.getHours() + 1 
      : minPublishTime.getHours();
    if (selectedHour < minHour) {
      setSelectedHour(minHour);
    }
  }
};
```

---

## Результат

- При `minHoursBeforePost = 10` и текущем времени 20:00, слоты на завтра будут доступны только с 06:00
- Логика корректно учитывает абсолютное время от текущего момента, а не от начала дня

