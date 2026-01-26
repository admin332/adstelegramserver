

## План: Исправление UI в DateTimeSelector

### Проблема 1: Белая обводка у выпадающего списка времени

**Файл:** `src/components/ui/select.tsx`

В `SelectContent` (строка 69) есть класс `border`, который создаёт белую обводку.

**Решение:** Добавить `border-0` в DateTimeSelector при использовании SelectContent:
```tsx
<SelectContent className="z-[60] border-0">
```

---

### Проблема 2: Неправильное выделение дат в календаре

**Причина:**
1. `day_today` подсвечивает сегодняшнюю дату (26 января) с `bg-accent`
2. `day_selected` не имеет `rounded-md` для закруглённых углов
3. Класс `cell` содержит `[&:has([aria-selected])]:bg-accent` который создаёт дополнительную квадратную подсветку вокруг выбранной даты

**Файл:** `src/components/ui/calendar.tsx`

**Решение:**
1. Добавить `rounded-md` к `day_selected` для закругления
2. Убрать `[&:has([aria-selected])]:bg-accent` из `cell` чтобы не было двойной подсветки
3. Оставить `day_today` только с кольцом или убрать чтобы не путать с выбранной датой

---

### Изменения

#### 1. `src/components/channel/DateTimeSelector.tsx`

Добавить `border-0` к SelectContent:

```tsx
<SelectContent className="z-[60] border-0">
```

#### 2. `src/components/ui/calendar.tsx`

Исправить классы:

```tsx
cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",

day_selected:
  "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md",

day_today: "ring-1 ring-accent text-accent-foreground",
```

**Что изменится:**
- Убрали `[&:has([aria-selected])]:bg-accent` и `[&:has([aria-selected].day-outside)]:bg-accent/50` из `cell` - убирает квадратную подсветку вокруг
- Добавили `rounded-md` к `day_selected` - теперь выбранная дата с закруглёнными углами
- Изменили `day_today` на ring вместо bg-accent - сегодняшняя дата показывается кольцом, а не заливкой

---

### Техническая сводка

| Файл | Изменение |
|------|-----------|
| `src/components/channel/DateTimeSelector.tsx` | Добавить `border-0` к SelectContent |
| `src/components/ui/calendar.tsx` | Исправить стили cell, day_selected, day_today |

