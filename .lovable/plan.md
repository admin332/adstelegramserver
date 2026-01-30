

## Фильтрация кампаний по типу на шаге 3

Добавлю проверку соответствия типа кампании требованиям канала.

---

## Данные

| Значение `acceptedCampaignTypes` | Что принимает канал |
|----------------------------------|---------------------|
| `'prompt'` | Только промпт-кампании |
| `'ready_post'` | Только кампании с готовым постом |
| `'both'` (по умолчанию) | Оба типа |

| Тип кампании в БД | Название |
|-------------------|----------|
| `'prompt'` | Промпт / Нативная реклама |
| `'ready_post'` | Готовый пост |

---

## Архитектура изменений

```text
Channel.tsx
    │
    └── OrderDrawer (+ acceptedCampaignTypes)
           │
           ├── Фильтрация кампаний по типу
           │
           └── CampaignSelector
                  ├── campaigns (уже отфильтрованные)
                  ├── acceptedCampaignTypes (новый prop)
                  └── Показывает предупреждение если список пуст
```

---

## Файлы для изменения

### 1. `src/pages/Channel.tsx`

**Передать `acceptedCampaignTypes` в OrderDrawer:**

```tsx
<OrderDrawer
  isOpen={isOrderDrawerOpen}
  onClose={() => setIsOrderDrawerOpen(false)}
  channelId={id!}
  channelName={channel.name}
  price1Post={channel.tonPrice}
  price2Plus={channel.tonPrice2Plus || channel.tonPrice}
  minHoursBeforePost={channel.minHoursBeforePost || 0}
  acceptedCampaignTypes={channel.acceptedCampaignTypes || 'both'}  // новое
/>
```

---

### 2. `src/components/channel/OrderDrawer.tsx`

**Обновить интерфейс props:**

```typescript
interface OrderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: string;
  channelName: string;
  price1Post: number;
  price2Plus: number;
  minHoursBeforePost?: number;
  acceptedCampaignTypes?: string;  // новое: 'prompt' | 'ready_post' | 'both'
}
```

**Добавить фильтрацию кампаний:**

```typescript
const { data: userCampaigns = [] } = useUserCampaigns();

// Фильтруем кампании по типу, который принимает канал
const filteredUserCampaigns = userCampaigns.filter(c => {
  if (acceptedCampaignTypes === 'both') return true;
  return c.campaign_type === acceptedCampaignTypes;
});

const campaigns = filteredUserCampaigns.map(c => {
  // ... existing mapping
});
```

**Передать тип в CampaignSelector:**

```tsx
<CampaignSelector
  campaigns={campaigns}
  selectedCampaigns={selectedCampaigns}
  requiredCount={quantity}
  onSelectionChange={setSelectedCampaigns}
  onCreateNew={handleCreateNewCampaign}
  acceptedCampaignTypes={acceptedCampaignTypes}  // новое
/>
```

---

### 3. `src/components/channel/CampaignSelector.tsx`

**Обновить интерфейс:**

```typescript
interface CampaignSelectorProps {
  campaigns: Campaign[];
  selectedCampaigns: string[];
  requiredCount: number;
  onSelectionChange: (ids: string[]) => void;
  onCreateNew: () => void;
  acceptedCampaignTypes?: string;  // новое
}
```

**Добавить функцию для отображения типа:**

```typescript
const getAcceptedTypeLabel = (type: string | undefined) => {
  switch (type) {
    case 'prompt':
      return 'промпт (нативная реклама)';
    case 'ready_post':
      return 'готовый пост';
    default:
      return null;
  }
};
```

**Обновить empty state с указанием нужного типа:**

```tsx
{/* Empty State - с учётом требований канала */}
{campaigns.length === 0 && (
  <div className="text-center py-8">
    {acceptedCampaignTypes && acceptedCampaignTypes !== 'both' ? (
      <>
        <p className="text-muted-foreground">
          Нет подходящих кампаний
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Этот канал принимает только кампании типа: <br />
          <span className="font-medium text-primary">
            {getAcceptedTypeLabel(acceptedCampaignTypes)}
          </span>
        </p>
      </>
    ) : (
      <>
        <p className="text-muted-foreground">У вас пока нет кампаний</p>
        <p className="text-sm text-muted-foreground mt-1">Создайте первую кампанию</p>
      </>
    )}
  </div>
)}
```

**Добавить информационное сообщение если канал принимает только определённый тип:**

```tsx
{/* Info about accepted types */}
{acceptedCampaignTypes && acceptedCampaignTypes !== 'both' && campaigns.length > 0 && (
  <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 text-center">
    <p className="text-sm text-muted-foreground">
      Канал принимает только: <span className="font-medium text-primary">{getAcceptedTypeLabel(acceptedCampaignTypes)}</span>
    </p>
  </div>
)}
```

---

## Визуальный результат

**Если канал принимает только промпт:**

```
┌─────────────────────────────────────────┐
│   Канал принимает только:               │
│   промпт (нативная реклама)             │
├─────────────────────────────────────────┤
│   [ Кампания 1 (промпт) ]               │
│   [ Кампания 2 (промпт) ]               │
├─────────────────────────────────────────┤
│   [ + Создать новую кампанию ]          │
└─────────────────────────────────────────┘
```

**Если нет подходящих кампаний:**

```
┌─────────────────────────────────────────┐
│           Нет подходящих кампаний       │
│                                         │
│   Этот канал принимает только кампании  │
│   типа: готовый пост                    │
├─────────────────────────────────────────┤
│   [ + Создать новую кампанию ]          │
└─────────────────────────────────────────┘
```

---

## Результат

- Кампании фильтруются по типу, который принимает канал
- Если канал принимает только определённый тип — показывается информационное сообщение
- Если подходящих кампаний нет — показывается пояснение какой тип нужен
- Кнопка "Создать новую кампанию" всегда доступна

