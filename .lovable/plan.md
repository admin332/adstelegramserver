

## План: Плавное затухание рамки в углах

### Текущее состояние

Сейчас рамка равномерная по всему периметру:

```text
┌─────────────────────────────────────┐
│ ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ │  ← Одинаковая яркость везде
│ ■                                ■ │
│ ■                                ■ │
│ ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ │
└─────────────────────────────────────┘
```

### Целевой эффект

Рамка должна плавно затухать в двух углах:

```text
┌─────────────────────────────────░░░░┐
│ ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■░░░░░ │  ← Затухание сверху-справа
│ ■                                ░ │
│ ░                                ■ │
│ ░░░░░░░■■■■■■■■■■■■■■■■■■■■■■■■■■ │  ← Затухание снизу-слева
└░░░░─────────────────────────────────┘
```

---

## Техническая реализация

### Подход: CSS mask с радиальными градиентами

Используем `mask-image` для создания плавного затухания в углах. Это позволит сохранить текущий градиент рамки, но сделать её прозрачной в нужных местах.

### Файл: `src/components/ChannelCard.tsx`

**Изменения в строках 102-104:**

Текущий код:
```tsx
{/* Gradient border using after pseudo-element */}
<div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-b from-blue-400 via-blue-500 to-blue-600 opacity-75 blur-[2px]" />
<div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-b from-blue-400 via-blue-500 to-blue-600" />
```

Новый код с маской:
```tsx
{/* Gradient border with corner fade */}
<div 
  className="absolute -inset-[1px] rounded-3xl bg-gradient-to-b from-blue-400 via-blue-500 to-blue-600 opacity-75 blur-[2px]" 
  style={{
    maskImage: 'radial-gradient(ellipse 80% 80% at 0% 100%, transparent 0%, black 50%), radial-gradient(ellipse 80% 80% at 100% 0%, transparent 0%, black 50%)',
    maskComposite: 'intersect',
    WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 0% 100%, transparent 0%, black 50%), radial-gradient(ellipse 80% 80% at 100% 0%, transparent 0%, black 50%)',
    WebkitMaskComposite: 'source-in'
  }}
/>
<div 
  className="absolute -inset-[1px] rounded-3xl bg-gradient-to-b from-blue-400 via-blue-500 to-blue-600" 
  style={{
    maskImage: 'radial-gradient(ellipse 80% 80% at 0% 100%, transparent 0%, black 50%), radial-gradient(ellipse 80% 80% at 100% 0%, transparent 0%, black 50%)',
    maskComposite: 'intersect',
    WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 0% 100%, transparent 0%, black 50%), radial-gradient(ellipse 80% 80% at 100% 0%, transparent 0%, black 50%)',
    WebkitMaskComposite: 'source-in'
  }}
/>
```

---

## Как работает маска

| Свойство | Значение | Описание |
|----------|----------|----------|
| `radial-gradient at 0% 100%` | Снизу-слева | Создаёт затухание в левом нижнем углу |
| `radial-gradient at 100% 0%` | Сверху-справа | Создаёт затухание в правом верхнем углу |
| `ellipse 80% 80%` | Размер | Плавный, не слишком большой срез |
| `transparent 0%, black 50%` | Градиент | Плавный переход от прозрачного к видимому |
| `mask-composite: intersect` | Объединение | Совмещает обе маски |

---

## Визуальный результат

```text
┌─────────────────────────────────░░░┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░   │
│ ▓                              ░  │
│ ▓                              ▓  │
│ ░                              ▓  │
│   ░░░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
└░░░────────────────────────────────┘

▓ = Яркая рамка
░ = Плавное затухание
  = Нет рамки
```

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/components/ChannelCard.tsx` | Добавить CSS mask к двум div-ам рамки (строки 102-104) |

