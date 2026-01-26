
## План: Фильтрация доступных часов для сегодняшней даты

### Проблема

При выборе сегодняшней даты:
- Можно выбрать время, которое уже прошло (например, 16:00 когда сейчас 16:20)
- Можно выбрать следующий час, до которого осталось меньше часа (например, 17:00 когда сейчас 16:20)

### Решение

Фильтровать список доступных часов в зависимости от выбранной даты:
- Если выбрана **сегодняшняя дата** - показывать только часы, до которых осталось **больше 1 часа**
- Если выбрана **будущая дата** - показывать все 24 часа

### Логика фильтрации

Если сейчас 16:20:
- Текущий час = 16
- Минимально допустимый час = 16 + 2 = 18 (18:00)
- Почему +2? Потому что 17:00 уже меньше чем через час

### Изменения в файлах

#### 1. `src/components/channel/DateTimeSelector.tsx`

**Добавить функцию проверки "сегодня":**
```typescript
import { format, addDays, isToday } from 'date-fns';
```

**Добавить вычисление минимального доступного часа:**
```typescript
const getMinAvailableHour = () => {
  const now = new Date();
  // Минимум через 2 часа от текущего (чтобы был зазор больше часа)
  return now.getHours() + 2;
};

const getAvailableHours = () => {
  if (isToday(selectedDate)) {
    const minHour = getMinAvailableHour();
    // Если minHour >= 24, значит на сегодня слотов нет
    return hours.filter(hour => hour >= minHour);
  }
  return hours;
};

const availableHours = getAvailableHours();
```

**Обновить рендеринг SelectContent:**
```tsx
<SelectContent className="z-[60] border-0">
  {availableHours.length > 0 ? (
    availableHours.map((hour) => (
      <SelectItem key={hour} value={hour.toString()}>
        {formatHour(hour)}
      </SelectItem>
    ))
  ) : (
    <div className="p-2 text-sm text-muted-foreground text-center">
      На сегодня нет доступных слотов
    </div>
  )}
</SelectContent>
```

#### 2. `src/components/channel/OrderDrawer.tsx`

**Обновить инициализацию selectedHour:**
```typescript
const [selectedHour, setSelectedHour] = useState(() => {
  const now = new Date();
  // Минимум через 2 часа
  const minHour = now.getHours() + 2;
  return minHour > 23 ? 0 : minHour;
});
```

**Добавить логику обновления selectedHour при смене даты:**

Передать колбек `onDateChange` который также сбрасывает час если он стал недоступен:

```typescript
const handleDateChange = (date: Date) => {
  setSelectedDate(date);
  
  // Если выбрана сегодняшняя дата и текущий час недоступен
  if (isToday(date)) {
    const minHour = new Date().getHours() + 2;
    if (selectedHour < minHour) {
      setSelectedHour(minHour > 23 ? 0 : minHour);
    }
  }
};
```

---

### Пример работы

| Текущее время | Доступные часы (сегодня) |
|---------------|--------------------------|
| 14:00         | 16:00, 17:00, ... 23:00  |
| 16:20         | 18:00, 19:00, ... 23:00  |
| 22:30         | нет доступных слотов     |
| любое (завтра)| 00:00 - 23:00            |

---

### Техническая сводка

| Файл | Изменение |
|------|-----------|
| `src/components/channel/DateTimeSelector.tsx` | Добавить фильтрацию часов для сегодняшней даты, импортировать `isToday` |
| `src/components/channel/OrderDrawer.tsx` | Обновить начальное значение часа (+2 вместо +1), добавить логику сброса при смене даты |
