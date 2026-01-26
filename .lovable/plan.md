

## План: Выравнивание цены по правому краю на карточке канала

### Проблема

Сейчас блок с ценой в правом верхнем углу карточки выглядит так:
- Контейнер имеет `text-right`, но внутренний flex-блок с ценой выравнивается по левому краю
- При маленькой сумме (например, `5` TON) остаётся пустое пространство справа

### Текущий код (строки 121-138)

```tsx
<div className="absolute top-3 right-3 text-right leading-tight">
  <motion.div
    className="font-bold text-2xl flex items-center gap-1.5"
  >
    <img src={TonIcon} ... />
    <span className="text-white">{tonPrice}</span>
  </motion.div>
  <span className="text-white/60 text-xs -mt-0.5 block">за 24 часа</span>
</div>
```

### Решение

Добавить `justify-end` к flex-контейнеру с ценой, чтобы иконка TON и сумма прижимались к правому краю:

```tsx
<div className="absolute top-3 right-3 text-right leading-tight">
  <motion.div
    className="font-bold text-2xl flex items-center justify-end gap-1.5"
  >
    <img src={TonIcon} ... />
    <span className="text-white">{tonPrice}</span>
  </motion.div>
  <span className="text-white/60 text-xs -mt-0.5 block">за 24 часа</span>
</div>
```

### Файл для изменения

| Файл | Изменение |
|------|-----------|
| `src/components/ChannelCard.tsx` | Добавить `justify-end` в строке 123 |

### Результат

- Иконка TON и сумма будут всегда прижаты к правому краю
- Текст "за 24 часа" уже имеет `text-right` и останется выровненным
- Пустое пространство справа исчезнет

