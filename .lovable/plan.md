
# Изменение кнопки "Купить" → "Канал"

## Текущее поведение

Кнопка "Купить" открывает страницу канала в приложении (`/channel/${id}`).

## Новое поведение

Кнопка "Канал" будет открывать Telegram-канал напрямую по ссылке `https://t.me/${username}`.

## Изменения

**Файл:** `src/components/ChannelCard.tsx`

### 1. Изменить функцию handleBuyClick (строки 59-62)

```tsx
// Было:
const handleBuyClick = (e: React.MouseEvent) => {
  e.stopPropagation();
  navigate(`/channel/${id}`);
};

// Станет:
const handleChannelClick = (e: React.MouseEvent) => {
  e.stopPropagation();
  window.open(`https://t.me/${username}`, '_blank');
};
```

### 2. Обновить кнопку (строки 204-210)

```tsx
// Было:
<Button
  size="sm"
  className="h-9 px-4 text-xs font-semibold rounded-full"
  onClick={handleBuyClick}
>
  Купить
</Button>

// Станет:
<Button
  size="sm"
  className="h-9 px-4 text-xs font-semibold rounded-full"
  onClick={handleChannelClick}
>
  Канал
</Button>
```

## Поведение кликов после изменения

| Область клика | Действие |
|---------------|----------|
| Вся карточка | Открывает страницу `/channel/:id` в приложении |
| Кнопка "Сердце" | Добавляет в избранное |
| Кнопка "Канал" | Открывает `https://t.me/username` в новой вкладке |

## Технические детали

- Используется `window.open()` с `_blank` для открытия в новой вкладке/окне
- `username` уже передаётся как prop в компонент
- `stopPropagation()` сохранён для предотвращения срабатывания клика на карточку
