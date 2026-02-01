

## План: Синяя градиентная обводка карточки канала

### Анализ эффекта из YieldCard

В примере используется техника **вложенных div с padding**:
- Внешний div имеет градиентный фон (это и есть "обводка")
- Внутренний div с `padding` создаёт видимость границы
- Внутренний контейнер заполняет оставшееся пространство

```text
┌─────────────────────────────────────┐
│  Внешний: синий градиент (рамка)   │  ← p-[1px]
│  ┌─────────────────────────────┐   │
│  │   Внутренний контент        │   │  ← Карточка
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

## Техническая реализация

### Файл: `src/components/ChannelCard.tsx`

**Текущая структура (строки 101-108):**
```tsx
<motion.div
  className={cn(
    'relative w-full h-48 rounded-3xl overflow-hidden cursor-pointer group'
  )}
  ...
>
```

**Новая структура с обёрткой:**
```tsx
{/* Outer wrapper with gradient border */}
<div className="relative w-full p-[1px] rounded-3xl bg-[linear-gradient(to_bottom,_#3b82f6,_#1d4ed8)]">
  {/* Inner card */}
  <motion.div
    className={cn(
      'relative w-full h-48 rounded-3xl overflow-hidden cursor-pointer group'
    )}
    ...
  >
    ... содержимое карточки ...
  </motion.div>
</div>
```

---

## Цветовая схема обводки

| Вариант | Верх | Низ | Описание |
|---------|------|-----|----------|
| **Яркий синий** | `#3b82f6` (blue-500) | `#1d4ed8` (blue-700) | Насыщенный, заметный |
| **Мягкий синий** | `#60a5fa` (blue-400) | `#2563eb` (blue-600) | Более светлый |
| **Тёмный синий** | `#2563eb` (blue-600) | `#1e40af` (blue-800) | Глубокий, премиальный |

Выберем **яркий синий** вариант для хорошей видимости.

---

## Изменения в коде

```tsx
// Строки 100-108 - добавить обёртку

{/* Gradient Border Wrapper */}
<div className="relative w-full p-[1px] rounded-3xl bg-[linear-gradient(to_bottom,_#3b82f6,_#1d4ed8)]">
  <motion.div
    className={cn(
      'relative w-full h-48 rounded-3xl overflow-hidden cursor-pointer group'
    )}
    variants={cardVariants}
    initial="hidden"
    animate="visible"
    onClick={handleCardClick}
  >
    {/* ... остальное содержимое карточки ... */}
  </motion.div>
</div>
```

И в конце добавить закрывающий `</div>`.

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/components/ChannelCard.tsx` | Обернуть карточку в div с градиентной границей |

