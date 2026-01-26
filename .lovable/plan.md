

## План: Добавить отображение суммы в USD на странице выбора количества постов

### Обзор

Добавим отображение эквивалента в долларах справа от итоговой суммы в TON в компоненте `PostQuantitySelector`. Будем использовать уже созданный хук `useTonPrice`.

### Изменения в `src/components/channel/PostQuantitySelector.tsx`

#### 1. Добавить импорт хука (строка 5)

```tsx
import { useTonPrice } from '@/hooks/useTonPrice';
```

#### 2. Использовать хук в компоненте (после строки 21)

```tsx
const { tonPrice } = useTonPrice();
```

#### 3. Обновить блок "Стоимость заказа" (строки 86-108)

Добавить отображение суммы в долларах справа от суммы в TON:

```tsx
{/* Price Calculation */}
<div className="bg-secondary/50 rounded-2xl p-4">
  <p className="text-sm text-muted-foreground text-center mb-2">
    Стоимость заказа
  </p>
  <div className="flex items-center justify-center gap-2">
    <span className="text-muted-foreground">
      {quantity} × {pricePerPost} TON =
    </span>
    <AnimatePresence mode="wait">
      <motion.div
        key={totalPrice}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className="flex items-center gap-1.5 font-bold text-xl"
      >
        <img src={TonIcon} alt="TON" className="w-5 h-5" />
        <span className="text-foreground">{totalPrice}</span>
      </motion.div>
    </AnimatePresence>
    {tonPrice && (
      <span className="text-sm text-muted-foreground">
        ≈ ${(totalPrice * tonPrice).toFixed(2)}
      </span>
    )}
  </div>
</div>
```

---

### Итоговый результат

До:
```
Стоимость заказа
2 × 50 TON = [TON icon] 100
```

После:
```
Стоимость заказа
2 × 50 TON = [TON icon] 100 ≈ $152.00
```

---

### Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/components/channel/PostQuantitySelector.tsx` | Добавить импорт и использование `useTonPrice`, отобразить сумму в USD |

