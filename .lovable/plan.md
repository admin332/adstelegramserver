

## Проблема
В карточках сделок (`DealCard`) используется `toFixed(0)` для округления USD-эквивалента, что даёт неточный результат.

При сделке на **1 TON** и курсе **1.52$**:
- `DealCard` показывает: `≈ $2` (округление 1.52 → 2)
- `PaymentDialog` показывает: `≈ $1.52` (два знака после запятой)

## Причина
В файле `src/components/DealCard.tsx` на строке 157:
```tsx
<span className="text-muted-foreground">≈ ${usdEquivalent.toFixed(0)}</span>
```

Метод `toFixed(0)` округляет 1.52 до 2, потому что стандартное округление JavaScript округляет 0.5 и выше вверх.

## Решение
Использовать `toFixed(2)` как в `PaymentDialog`, чтобы отображать курс с двумя знаками после запятой.

## Изменения

**`src/components/DealCard.tsx`** — строка 157:

```text
Было:
<span className="text-muted-foreground">≈ ${usdEquivalent.toFixed(0)}</span>

Будет:
<span className="text-muted-foreground">≈ ${usdEquivalent.toFixed(2)}</span>
```

## Результат
После изменения:
- 1 TON @ $1.52 → отобразится как `≈ $1.52` вместо `≈ $2`
- Консистентное отображение цен во всех компонентах приложения

