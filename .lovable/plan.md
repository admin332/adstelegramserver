
# Улучшение скелетонов карточек каналов

## Обзор

Текущие скелетоны не соответствуют реальной структуре карточки канала. Нужно создать реалистичный скелетон, повторяющий дизайн `ChannelCard`.

## Текущий скелетон (примитивный)

```
┌─────────────────────────────────────────────┐
│ ⚪  ████████                    ████        │
│     ██████                                  │
└─────────────────────────────────────────────┘
```

## Новый скелетон (реалистичный)

```
┌─────────────────────────────────────────────┐
│ ▓▓▓▓  ▓▓▓▓                           ▓▓▓   │  <- badges + price
│                                       ▓▓   │
│ ▓▓▓▓▓▓▓▓▓▓                                 │  <- subscribers
│                                             │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓                  ⚪  ████   │  <- name + buttons
│ ▓▓▓▓▓▓▓▓▓                                  │  <- username
└─────────────────────────────────────────────┘
```

## Изменения

### 1. Создание компонента ChannelCardSkeleton

**Новый файл:** `src/components/ChannelCardSkeleton.tsx`

Компонент будет повторять структуру `ChannelCard`:
- Высота 192px (h-48)
- Закруглённые углы (rounded-3xl)
- Градиентный фон слева (от синего к тёмному)
- Скелетон изображения справа
- Скелетоны для:
  - Бейджей просмотров и категории (слева вверху)
  - Цены в TON (справа вверху)
  - Количества подписчиков (по центру слева)
  - Названия и username (внизу слева)
  - Кнопок лайка и действия (внизу справа)

```tsx
export const ChannelCardSkeleton = () => {
  return (
    <div className="relative w-full h-48 rounded-3xl overflow-hidden bg-gradient-to-b from-[hsl(217,91%,50%)] to-[hsl(224,76%,48%)]">
      {/* Right side - image placeholder */}
      <div 
        className="absolute inset-0 bg-secondary/30"
        style={{ clipPath: 'polygon(50% 0, 100% 0, 100% 100%, 50% 100%)' }}
      />
      
      {/* Top left - badges */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <Skeleton className="h-6 w-14 rounded-full bg-white/20" />
        <Skeleton className="h-6 w-20 rounded-full bg-white/20" />
      </div>
      
      {/* Top right - price */}
      <div className="absolute top-3 right-3">
        <Skeleton className="h-7 w-16 rounded-md bg-white/20" />
        <Skeleton className="h-3 w-14 mt-1 rounded-md bg-white/20" />
      </div>
      
      {/* Center left - subscribers */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2">
        <Skeleton className="h-8 w-24 rounded-md bg-white/20" />
      </div>
      
      {/* Bottom content */}
      <div className="absolute inset-x-0 bottom-0 p-4">
        <div className="flex items-end justify-between">
          <div className="flex-1">
            <Skeleton className="h-5 w-32 rounded-md bg-white/20" />
            <Skeleton className="h-4 w-24 mt-1 rounded-md bg-white/20" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="w-9 h-9 rounded-full bg-white/20" />
            <Skeleton className="w-16 h-9 rounded-full bg-white/20" />
          </div>
        </div>
      </div>
    </div>
  );
};
```

### 2. Обновление главной страницы (Index.tsx)

**Файл:** `src/pages/Index.tsx`

- Импортировать `ChannelCardSkeleton`
- Добавить скелетоны для StatsCard при загрузке
- Заменить примитивные скелетоны на `ChannelCardSkeleton`

```tsx
// Скелетоны статистики
<div className="grid grid-cols-2 gap-3">
  {isLoading ? (
    <>
      <div className="bg-secondary rounded-2xl p-4">
        <Skeleton className="h-4 w-20 mb-2" />
        <Skeleton className="h-8 w-16" />
      </div>
      <div className="bg-secondary rounded-2xl p-4">
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-8 w-20" />
      </div>
    </>
  ) : (
    <>
      <StatsCard ... />
      <StatsCard ... />
    </>
  )}
</div>

// Скелетоны карточек каналов
{isLoading ? (
  [1, 2, 3].map((i) => <ChannelCardSkeleton key={i} />)
) : ...}
```

### 3. Обновление страницы каталога (Channels.tsx)

**Файл:** `src/pages/Channels.tsx`

- Импортировать `ChannelCardSkeleton`
- Добавить скелетон для счётчика "Найдено: X каналов"
- Заменить примитивные скелетоны на `ChannelCardSkeleton`

```tsx
// Счётчик каналов
<div className="text-sm text-muted-foreground">
  {isLoading ? (
    <Skeleton className="h-4 w-32" />
  ) : (
    `Найдено: ${filteredChannels.length} каналов`
  )}
</div>

// Карточки каналов
{isLoading ? (
  [1, 2, 3, 4].map((i) => <ChannelCardSkeleton key={i} />)
) : ...}
```

## Визуальные особенности скелетона

| Элемент | Класс скелетона |
|---------|-----------------|
| Бейджи | `bg-white/20 rounded-full` |
| Цена | `bg-white/20 rounded-md` |
| Подписчики | `bg-white/20 rounded-md` |
| Название | `bg-white/20 rounded-md` |
| Кнопки | `bg-white/20 rounded-full` |

Скелетоны используют полупрозрачный белый цвет (`bg-white/20`) на градиентном фоне карточки, чтобы сохранить общий стиль и цветовую схему.

## Файлы для изменения

| Файл | Действие |
|------|----------|
| `src/components/ChannelCardSkeleton.tsx` | Создать новый компонент |
| `src/pages/Index.tsx` | Заменить скелетоны на новые |
| `src/pages/Channels.tsx` | Заменить скелетоны на новые |
