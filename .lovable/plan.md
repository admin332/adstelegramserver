

# Убрать фон и бордюр у кнопки "Посмотреть в блокчейне"

## Обзор

Изменяем стиль кнопки просмотра в блокчейне для сделок со статусом "Ожидает оплаты" — убираем фон и обводку.

## Изменение

**Файл:** `src/components/DealCard.tsx`

Меняем `variant="outline"` на `variant="ghost"` для кнопки на строках 339-345:

```tsx
// Было
<Button 
  variant="outline" 
  size="sm"
  onClick={handleViewBlockchain}
>
  <ExternalLink className="w-4 h-4" />
</Button>

// Станет
<Button 
  variant="ghost" 
  size="sm"
  onClick={handleViewBlockchain}
>
  <ExternalLink className="w-4 h-4" />
</Button>
```

## Результат

Кнопка будет прозрачной без фона и бордюра, станет видна только иконка и hover-эффект.

