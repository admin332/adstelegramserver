

## План: Изменение формы стоимости размещения

### Изменения в `src/components/create/AddChannelWizard.tsx`

#### 1. Изменить заголовок (строка 248)

```tsx
// Было:
<Label>Стоимость размещения ($)</Label>

// Станет:
<Label>Стоимость размещения (TON за пост)</Label>
```

#### 2. Изменить поля ввода цен (строки 249-280)

Заменить 3 поля на 2 поля с новыми лейблами:

**Было:** 3 поля - "1/24", "2/48", "Пост"

**Станет:** 2 поля - "1/24" (цена за 1 пост), "2+/24" (цена при заказе 2+ постов)

```tsx
<div className="grid grid-cols-2 gap-3">
  <div className="space-y-1">
    <span className="text-xs text-muted-foreground">1/24</span>
    <Input
      type="number"
      placeholder="0"
      value={channelData.price_1_24}
      onChange={(e) => setChannelData({ ...channelData, price_1_24: e.target.value })}
      className="bg-card border-0"
    />
  </div>
  <div className="space-y-1">
    <span className="text-xs text-muted-foreground">2+/24</span>
    <Input
      type="number"
      placeholder="0"
      value={channelData.price_2_48}
      onChange={(e) => setChannelData({ ...channelData, price_2_48: e.target.value })}
      className="bg-card border-0"
    />
  </div>
</div>
```

#### 3. Убрать третье поле "Пост"

Поле `price_post` больше не нужно в форме - остаются только два тарифа.

---

### Итоговые изменения

| Строки | Изменение |
|--------|-----------|
| 248 | `Стоимость размещения ($)` → `Стоимость размещения (TON за пост)` |
| 249 | `grid-cols-3` → `grid-cols-2` |
| 251 | Лейбл "1/24" остаётся |
| 261 | Лейбл "2/48" → "2+/24" |
| 270-279 | Убрать третий input (поле "Пост") |

---

### Логика ценообразования

- **1/24** — цена за 1 пост на 24 часа
- **2+/24** — цена за пост при заказе 2 и более постов (может быть дешевле или дороже)

