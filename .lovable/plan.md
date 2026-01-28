

# Анимация появления стикера снизу вверх

## Проблема

Сейчас при смене категории/фильтров стикер остаётся на месте, пока карточка меняется. Это создаёт визуальный глитч.

## Решение

Стикер будет:
1. Скрыт изначально (смещён вниз за пределы видимости)
2. Появляться с анимацией "снизу вверх" только после загрузки карточки
3. Сбрасывать анимацию при смене фильтров/категорий

## Технические изменения

### Файл: `src/pages/Index.tsx`

**1. Добавить импорт `useEffect`:**
```tsx
import { useState, useMemo, useEffect } from "react";
```

**2. Добавить состояние для отслеживания готовности стикера:**
```tsx
const [stickerReady, setStickerReady] = useState(false);
```

**3. Добавить эффект для сброса и запуска анимации:**
```tsx
// Сбрасываем стикер при смене фильтров и запускаем анимацию после загрузки карточки
useEffect(() => {
  setStickerReady(false);
  
  if (!isLoading && filteredChannels.length > 0) {
    // Небольшая задержка для плавного появления после карточки
    const timer = setTimeout(() => {
      setStickerReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }
}, [filteredChannels, isLoading, activeCategory, searchQuery, showFavoritesOnly, sortBy]);
```

**4. Обновить контейнер стикера с анимацией:**
```tsx
{index === 0 && (
  <div 
    className={`absolute -top-20 left-1/2 translate-x-8 z-0 pointer-events-none 
      transition-all duration-500 ease-out
      ${stickerReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
  >
    <TgsSticker 
      src={animatedSticker}
      className="w-24 h-24"
    />
  </div>
)}
```

## Как это работает

1. При изменении любого фильтра — `stickerReady` сбрасывается в `false`
2. Стикер получает классы `opacity-0 translate-y-8` — невидим и смещён вниз
3. После загрузки карточки через 100мс — `stickerReady` становится `true`
4. Стикер плавно появляется с `transition-all duration-500 ease-out`, поднимаясь вверх

## Результат

Стикер будет красиво выезжать снизу вверх каждый раз, когда меняются фильтры или категории, появляясь только после загрузки карточки канала.

