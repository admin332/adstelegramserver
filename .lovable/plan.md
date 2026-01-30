

## Изменение текста в карточке пиковой активности

Простое изменение UI: убрать бейдж из шапки и добавить информацию о пике в подпись снизу.

---

## Что изменится

| Было | Станет |
|------|--------|
| Шапка: `⏰ Пиковая активность` + `🎯 00:00` | Шапка: только `⏰ Пиковая активность` |
| Подпись: `Активность аудитории по часам (UTC+3)` | Подпись: `Лучшая активность аудитории в (00:00)` |

---

## Изменяемый файл

**src/components/channel/ChannelAnalytics.tsx**

### 1. Удалить бейдж из шапки (строка ~220-225)

**Было:**
```tsx
<div className="flex items-center justify-between mb-3">
  <div className="flex items-center gap-2">
    <Clock className="h-5 w-5 text-primary" />
    <span className="font-medium text-foreground">Пиковая активность</span>
  </div>
  <div className="flex items-center gap-1 text-primary text-sm">
    <span>🎯</span>
    <span className="font-semibold">
      {peakHour.displayHour.toString().padStart(2,'0')}:00
    </span>
  </div>
</div>
```

**Станет:**
```tsx
<div className="flex items-center gap-2 mb-3">
  <Clock className="h-5 w-5 text-primary" />
  <span className="font-medium text-foreground">Пиковая активность</span>
</div>
```

### 2. Изменить подпись снизу (строка ~270)

**Было:**
```tsx
<p className="text-xs text-muted-foreground text-center mt-2">
  Активность аудитории по часам (UTC+3)
</p>
```

**Станет:**
```tsx
<p className="text-xs text-muted-foreground text-center mt-2">
  Лучшая активность аудитории в ({peakHour.displayHour.toString().padStart(2,'0')}:00)
</p>
```

---

## Визуальный результат

```text
╭─────────────────────────────────────────╮
│ ⏰ Пиковая активность                   │
├─────────────────────────────────────────┤
│                              ▲          │
│                             ╱ ╲         │
│           ▲               ╱   ╲         │
│          ╱ ╲    ▲   ▲   ╱     ╲        │
│    ▲    ╱   ╲  ╱ ╲ ╱ ╲ ╱       ╲       │
│   ╱ ╲  ╱     ╲╱   ╲   ╲         ╲      │
│▔▔▔░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▔▔▔│
│ 0h   3h   6h   9h   12h  15h  18h  21h │
├─────────────────────────────────────────┤
│   Лучшая активность аудитории в (00:00) │
╰─────────────────────────────────────────╯
```

