
# Кликабельные карточки каналов

## Текущая ситуация

Карточка `ChannelCard` имеет класс `cursor-pointer`, но при клике на неё (вне кнопок) ничего не происходит. Открытие канала работает только через кнопку "Купить".

## Решение

Добавить `onClick` обработчик на главный контейнер карточки для навигации на страницу канала.

## Изменения

**Файл:** `src/components/ChannelCard.tsx`

### Добавить функцию handleCardClick (после строки 62)

```tsx
const handleCardClick = () => {
  navigate(`/channel/${id}`);
};
```

### Добавить onClick на motion.div (строка 84)

```tsx
// Было:
<motion.div
  className={cn(
    'relative w-full h-48 rounded-3xl overflow-hidden cursor-pointer group'
  )}
  variants={cardVariants}
  initial="hidden"
  animate="visible"
>

// Станет:
<motion.div
  className={cn(
    'relative w-full h-48 rounded-3xl overflow-hidden cursor-pointer group'
  )}
  variants={cardVariants}
  initial="hidden"
  animate="visible"
  onClick={handleCardClick}
>
```

## Поведение кликов

| Область клика | Действие |
|---------------|----------|
| Вся карточка | Открывает `/channel/:id` |
| Кнопка "Сердце" | Добавляет в избранное (stopPropagation) |
| Кнопка "Купить" | Открывает `/channel/:id` (stopPropagation) |

## Примечание

`stopPropagation()` уже есть на кнопках `handleLikeClick` и `handleBuyClick`, поэтому клики на них не будут "всплывать" к родительскому обработчику.

## Затронутые страницы

- **Главная** (`/`) — карточки в "Популярные каналы"
- **Каталог** (`/channels`) — все карточки каналов
