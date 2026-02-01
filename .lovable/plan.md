

## План: Металлический эффект для карточки канала

### Текущее состояние

| Элемент | Сейчас | Новое |
|---------|--------|-------|
| **Левая часть** | Синий градиент `from-[hsl(217,91%,50%)] to-[hsl(224,76%,48%)]` | Металлический эффект |
| **Структура** | Один слой | Многослойный металл |

---

## Анализ металлического эффекта

Эффект в `YieldCard` создаётся тремя слоями:

```
┌─────────────────────────────────────┐
│  Внешний: from-neutral-800/900     │  ← Основа (тёмная)
│  ┌─────────────────────────────┐   │
│  │ Рамка: #3b3b3b → #1a1a1a    │   │  ← Светлая → тёмная граница
│  │  ┌─────────────────────┐    │   │
│  │  │ Внутри: #262626     │    │   │  ← Контент
│  │  │        ↓            │    │   │
│  │  │      #1a1a1a        │    │   │
│  │  └─────────────────────┘    │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

## Техническая реализация

### Файл: `src/components/ChannelCard.tsx`

**Изменения в строке 110-111:**

Заменить текущий синий фон:
```tsx
{/* Blue Background - Left Side */}
<div className="absolute inset-0 bg-gradient-to-b from-[hsl(217,91%,50%)] to-[hsl(224,76%,48%)]" />
```

На многослойный металлический эффект:
```tsx
{/* Metal Background - Left Side */}
<div className="absolute inset-0 bg-gradient-to-b from-neutral-800 to-neutral-900" />
{/* Metal shine overlay */}
<div className="absolute inset-0 left-0 w-1/2">
  <div className="relative h-full p-[1px] rounded-l-3xl bg-[linear-gradient(to_bottom,_#4a4a4a,_#1a1a1a)]">
    <div className="h-full rounded-l-3xl bg-[linear-gradient(to_bottom,_#2d2d2d,_#1a1a1a)]" />
  </div>
</div>
```

Или упрощённый вариант без вложенности:
```tsx
{/* Metal Background - Left Side */}
<div className="absolute inset-0 bg-gradient-to-b from-neutral-800 to-neutral-900">
  {/* Top shine effect */}
  <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/10 to-transparent" />
  {/* Left edge shine */}
  <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-white/20 via-white/10 to-transparent" />
</div>
```

---

## Визуальное сравнение

| Аспект | Синий (сейчас) | Металл (новое) |
|--------|----------------|----------------|
| **Цвет** | Яркий синий | Тёмно-серый металлик |
| **Глубина** | Плоский | Многослойный с бликами |
| **Границы** | Нет | Светящиеся края сверху |
| **Стиль** | Яркий, цветной | Премиальный, нейтральный |

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/components/ChannelCard.tsx` | Заменить синий градиент на металлический эффект (строки 110-111) |

