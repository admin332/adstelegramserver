

## Добавление бейджа типа кампаний в карточки каналов

Добавлю бейдж с типом принимаемых кампаний ("По промту", "Готовый пост", "Все кампании") в верхнюю левую часть карточки канала, рядом с просмотрами и категорией.

---

## Данные

| Значение `acceptedCampaignTypes` | Отображаемый текст |
|----------------------------------|-------------------|
| `'prompt'` | По промту |
| `'ready_post'` | Готовый пост |
| `'both'` (или `undefined`) | Все кампании |

---

## Файлы для изменения

### 1. `src/components/ChannelCard.tsx`

**Добавить в интерфейс `ChannelCardProps`:**

```typescript
interface ChannelCardProps {
  // ... existing props
  acceptedCampaignTypes?: string;  // новое
}
```

**Добавить функцию для получения лейбла:**

```typescript
const getCampaignTypeLabel = (type: string | undefined): string => {
  switch (type) {
    case 'prompt':
      return 'По промту';
    case 'ready_post':
      return 'Готовый пост';
    default:
      return 'Все кампании';
  }
};
```

**Добавить новый бейдж в секцию badges (строка ~112):**

```tsx
{/* Category & Views Badge - Left */}
<div className="absolute top-3 left-3 flex items-center gap-2 flex-wrap">
  <div className="bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
    <Eye className="w-3 h-3" />
    <span>{formatNumber(avgViews)}</span>
  </div>
  <div className="bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-full">
    {getCategoryById(category)?.name || category}
  </div>
  {/* Новый бейдж типа кампании */}
  <div className="bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-full">
    {getCampaignTypeLabel(acceptedCampaignTypes)}
  </div>
</div>
```

---

### 2. `src/pages/Index.tsx`

**Передать `acceptedCampaignTypes` в `ChannelCard`:**

```tsx
<ChannelCard 
  {...channel} 
  isLiked={isFavorite(channel.id)}
  onLikeToggle={toggleFavorite}
  acceptedCampaignTypes={channel.acceptedCampaignTypes}  // добавить
/>
```

---

### 3. `src/pages/Channels.tsx`

**Передать `acceptedCampaignTypes` в `ChannelCard`:**

```tsx
<ChannelCard 
  key={channel.id} 
  {...channel} 
  isLiked={isFavorite(channel.id)}
  onLikeToggle={toggleFavorite}
  acceptedCampaignTypes={channel.acceptedCampaignTypes}  // добавить
/>
```

---

### 4. `src/data/mockChannels.ts`

**Добавить `acceptedCampaignTypes` в mock данные для тестирования:**

```typescript
{
  id: "1",
  name: "CryptoNews",
  // ...
  acceptedCampaignTypes: "both",  // или "prompt", "ready_post"
},
```

---

## Визуальный результат

```text
┌─────────────────────────────────────────────────────┐
│ [👁 3.5K] [Лайфстайл] [Все кампании]     ⚡ 25 TON │
│                                          за 24 часа │
│ 👥 67K                                              │
│                                                     │
│ FitLife                          [❤️] [Канал]      │
│ @fitlife_ru                                         │
└─────────────────────────────────────────────────────┘
```

---

## Результат

- Каждая карточка канала показывает какие типы кампаний принимает канал
- Рекламодатель сразу видит подходит ли ему канал по типу рекламы
- Стиль бейджа соответствует существующим бейджам (просмотры, категория)

