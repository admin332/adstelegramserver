

## Цель
Изменить кнопку "Заказать рекламу" на странице канала:
1. Убрать иконку корзины (ShoppingCart)
2. Переместить цену "1 TON" в начало кнопки

## Текущий код (строки 197-206)

```tsx
<Button
  onClick={() => setIsOrderDrawerOpen(true)}
  className="w-full h-14 text-base font-semibold rounded-2xl gap-3"
>
  <ShoppingCart className="h-5 w-5" />
  Заказать рекламу
  <span className="text-white/80 ml-2">
    {channel.tonPrice} TON
  </span>
</Button>
```

## Изменения

**Файл**: `src/pages/Channel.tsx`

1. Удалить строку с `<ShoppingCart className="h-5 w-5" />`
2. Переместить `{channel.tonPrice} TON` перед текстом "Заказать рекламу"

## Новый код

```tsx
<Button
  onClick={() => setIsOrderDrawerOpen(true)}
  className="w-full h-14 text-base font-semibold rounded-2xl gap-3"
>
  <span className="text-white/80">
    {channel.tonPrice} TON
  </span>
  Заказать рекламу
</Button>
```

## Визуальный результат

До:
```
[🛒 Заказать рекламу         1 TON]
```

После:
```
[1 TON  Заказать рекламу]
```

## Дополнительно

Также нужно удалить неиспользуемый импорт `ShoppingCart` из lucide-react (строка 4), чтобы избежать предупреждений линтера.

