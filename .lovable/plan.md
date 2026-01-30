

## Исправление ценообразования при заказе нескольких постов

При выборе 2+ постов должна применяться сниженная цена `price_2_48`, а не `price_1_24`.

---

## Текущая проблема

| Количество | Ожидаемая цена | Текущая цена |
|------------|----------------|--------------|
| 1 пост | `price_1_24` | `price_1_24` ✓ |
| 2+ постов | `price_2_48` | `price_1_24` ✗ |

---

## Архитектура изменений

```text
Channel.tsx
    │
    └── OrderDrawer
           ├── price1Post (новый prop)
           ├── price2Plus (новый prop)
           │
           └── PostQuantitySelector
                  ├── pricePerPost (динамический)
                  └── отображает текущую цену
```

---

## Файлы для изменения

### 1. `src/data/mockChannels.ts`

Добавить новое поле в интерфейс `Channel`:

```typescript
export interface Channel {
  // ... existing fields
  tonPrice: number;        // цена за 1 пост (price_1_24)
  tonPrice2Plus?: number;  // цена за 2+ постов (price_2_48)
  // ...
}
```

---

### 2. `src/hooks/useChannels.ts`

Добавить маппинг для `price_2_48`:

```typescript
function mapDatabaseToChannel(dbChannel: DatabaseChannel): Channel {
  const tonPrice = Number(dbChannel.price_1_24) || 0;
  const tonPrice2Plus = Number(dbChannel.price_2_48) || tonPrice; // fallback на price_1_24
  
  return {
    // ... existing fields
    tonPrice: tonPrice,
    tonPrice2Plus: tonPrice2Plus,
    // ...
  };
}
```

---

### 3. `src/pages/Channel.tsx`

Передать обе цены в `OrderDrawer`:

```tsx
<OrderDrawer
  isOpen={isOrderDrawerOpen}
  onClose={() => setIsOrderDrawerOpen(false)}
  channelId={id!}
  channelName={channel.name}
  price1Post={channel.tonPrice}
  price2Plus={channel.tonPrice2Plus || channel.tonPrice}
  minHoursBeforePost={channel.minHoursBeforePost || 0}
/>
```

---

### 4. `src/components/channel/OrderDrawer.tsx`

**Изменить интерфейс props:**

```typescript
interface OrderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: string;
  channelName: string;
  price1Post: number;      // было pricePerPost
  price2Plus: number;      // новое
  minHoursBeforePost?: number;
}
```

**Добавить динамический расчёт цены:**

```typescript
// Динамическая цена в зависимости от количества
const pricePerPost = quantity >= 2 ? price2Plus : price1Post;
const totalPrice = quantity * pricePerPost;
```

**Обновить вызов создания сделки:**

```typescript
const { data, error } = await supabase.functions.invoke('create-deal', {
  body: {
    initData,
    channelId,
    postsCount: quantity,
    pricePerPost,  // теперь динамическая цена
    totalPrice,
    scheduledAt: scheduledDate.toISOString(),
    campaignIds: selectedCampaigns,
  }
});
```

---

### 5. `src/components/channel/PostQuantitySelector.tsx`

Добавить отображение экономии при выборе 2+ постов:

```typescript
interface PostQuantitySelectorProps {
  quantity: number;
  pricePerPost: number;
  price1Post: number;      // для показа сравнения
  price2Plus: number;      // для показа сравнения
  onQuantityChange: (quantity: number) => void;
  minQuantity?: number;
  maxQuantity?: number;
}
```

Добавить индикатор скидки:

```tsx
{quantity >= 2 && price2Plus < price1Post && (
  <div className="text-green-500 text-sm text-center mt-2">
    💰 Экономия: {(price1Post - price2Plus) * quantity} TON
  </div>
)}
```

---

## Визуальный результат

**При выборе 1 поста:**
```
┌─────────────────────────────────────┐
│         [ - ]   1   [ + ]           │
│          пост на 24 часа            │
├─────────────────────────────────────┤
│        1 × 50 TON = 50 TON          │
│             ≈ $175.00               │
└─────────────────────────────────────┘
```

**При выборе 3 постов (со скидкой):**
```
┌─────────────────────────────────────┐
│         [ - ]   3   [ + ]           │
│         поста на 24 часа            │
├─────────────────────────────────────┤
│        3 × 40 TON = 120 TON         │
│             ≈ $420.00               │
│   💰 Экономия: 30 TON               │
└─────────────────────────────────────┘
```

---

## Результат

- При выборе 1 поста — используется `price_1_24`
- При выборе 2+ постов — используется `price_2_48` (сниженная цена)
- Отображается экономия при заказе нескольких постов
- Правильная цена передаётся в edge function `create-deal`

