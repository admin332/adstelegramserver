

## Логика выбора кампаний по типу

Изменяем поведение выбора кампаний в зависимости от типа рекламы.

---

## Правила

| Тип кампании | Количество постов | Требуется кампаний |
|--------------|-------------------|-------------------|
| `prompt` | 1, 2, 3... любое | **Всегда 1** |
| `ready_post` | 1 | 1 |
| `ready_post` | 2 | 2 |
| `ready_post` | 3 | 3 |

**Дополнительно для каналов с `acceptedCampaignTypes = 'both'`:**
- После выбора первой кампании — показываем только кампании того же типа
- Если выбрана промпт-кампания — больше ничего выбрать нельзя
- Если выбрана ready_post — промпт-кампании скрываются

---

## Архитектура изменений

```text
OrderDrawer
    │
    ├── selectedCampaigns (текущие выбранные)
    ├── selectedCampaignType (новое состояние: null | 'prompt' | 'ready_post')
    │
    ├── Вычисление requiredCount:
    │   └── if selectedCampaignType === 'prompt' → 1
    │   └── else → quantity (количество постов)
    │
    ├── Фильтрация campaigns:
    │   └── if selectedCampaignType !== null → только этот тип
    │   └── else → по acceptedCampaignTypes канала
    │
    └── CampaignSelector
          ├── campaigns (отфильтрованные)
          ├── requiredCount (динамический)
          ├── onSelectionChange (с логикой определения типа)
          └── Обновлённый UI для показа правил
```

---

## Файлы для изменения

### 1. `src/components/channel/OrderDrawer.tsx`

**Добавить состояние для отслеживания выбранного типа:**

```typescript
const [selectedCampaignType, setSelectedCampaignType] = useState<string | null>(null);
```

**Вычислить динамический requiredCount:**

```typescript
// Для промпта нужна только 1 кампания, для ready_post — по количеству постов
const requiredCampaignsCount = selectedCampaignType === 'prompt' ? 1 : quantity;
```

**Обновить фильтрацию кампаний:**

```typescript
// Фильтруем кампании
const filteredUserCampaigns = userCampaigns.filter(c => {
  // Если уже выбран тип — показываем только этот тип
  if (selectedCampaignType) {
    return c.campaign_type === selectedCampaignType;
  }
  // Иначе фильтруем по настройкам канала
  if (acceptedCampaignTypes === 'both') return true;
  return c.campaign_type === acceptedCampaignTypes;
});
```

**Обновить handleSelectionChange для определения типа:**

```typescript
const handleCampaignSelectionChange = (ids: string[]) => {
  setSelectedCampaigns(ids);
  
  if (ids.length === 0) {
    // Сбросить тип если ничего не выбрано
    setSelectedCampaignType(null);
  } else if (ids.length === 1 && selectedCampaignType === null) {
    // Определить тип по первой выбранной кампании
    const selectedCampaign = userCampaigns.find(c => c.id === ids[0]);
    if (selectedCampaign) {
      setSelectedCampaignType(selectedCampaign.campaign_type);
    }
  }
};
```

**Обновить canProceed для шага 3:**

```typescript
case 3:
  return selectedCampaigns.length === requiredCampaignsCount;
```

**Обновить subtitle для шага 3:**

```typescript
3: selectedCampaignType === 'prompt' 
  ? 'Выберите 1 кампанию (промпт)'
  : quantity > 1 
    ? `Выберите ${quantity} кампании` 
    : 'Выберите кампанию',
```

**Сбросить тип при возврате на шаг 3:**

```typescript
const handleBack = () => {
  if (currentStep > 1) {
    setCurrentStep(currentStep - 1);
    if (currentStep === 4) {
      setEscrowAddress(null);
      setDealId(null);
    }
    // Сбросить выбор кампаний при возврате на шаг 2
    if (currentStep === 3) {
      setSelectedCampaigns([]);
      setSelectedCampaignType(null);
    }
  }
};
```

---

### 2. `src/components/channel/CampaignSelector.tsx`

**Обновить интерфейс:**

```typescript
interface CampaignSelectorProps {
  campaigns: Campaign[];
  selectedCampaigns: string[];
  requiredCount: number;
  onSelectionChange: (ids: string[]) => void;
  onCreateNew: () => void;
  acceptedCampaignTypes?: string;
  selectedCampaignType?: string | null;  // новое
  isPromptMode?: boolean;  // новое: для UI подсказок
}
```

**Обновить handleToggleCampaign:**

```typescript
const handleToggleCampaign = (campaignId: string) => {
  if (selectedCampaigns.includes(campaignId)) {
    // Снять выбор
    onSelectionChange(selectedCampaigns.filter((id) => id !== campaignId));
  } else {
    // Если промпт — только 1 кампания
    if (requiredCount === 1) {
      onSelectionChange([campaignId]);
    } else if (selectedCampaigns.length < requiredCount) {
      onSelectionChange([...selectedCampaigns, campaignId]);
    }
  }
};
```

**Добавить информационное сообщение о правилах:**

```tsx
{/* Info about prompt mode */}
{isPromptMode && (
  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
    <p className="text-sm text-muted-foreground">
      Для промпт-рекламы нужна только <span className="font-medium text-blue-500">1 кампания</span> независимо от количества постов
    </p>
  </div>
)}

{/* Info when type is locked */}
{selectedCampaignType && acceptedCampaignTypes === 'both' && (
  <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 text-center">
    <p className="text-sm text-muted-foreground">
      Выбран тип: <span className="font-medium text-primary">{getAcceptedTypeLabel(selectedCampaignType)}</span>
    </p>
  </div>
)}
```

**Обновить Selection Info:**

```tsx
{/* Selection Info */}
{requiredCount > 1 && (
  <p className="text-sm text-muted-foreground text-center">
    Выбрано {selectedCampaigns.length} из {requiredCount} кампаний
  </p>
)}
{requiredCount === 1 && selectedCampaigns.length === 0 && (
  <p className="text-sm text-muted-foreground text-center">
    Выберите кампанию
  </p>
)}
```

---

## Визуальный результат

**Канал принимает оба типа, выбрано 3 поста:**

```
Шаг 1: [3 поста]
Шаг 2: [дата/время]
Шаг 3:
┌─────────────────────────────────────────┐
│   [ Промпт кампания 1 ]  ← кликаем      │
│   [ Промпт кампания 2 ]                 │
│   [ Ready Post 1 ]                      │
│   [ Ready Post 2 ]                      │
└─────────────────────────────────────────┘
```

**После выбора промпт-кампании:**

```
┌─────────────────────────────────────────┐
│   Выбран тип: промпт (нативная реклама) │
│   Для промпт-рекламы нужна только       │
│   1 кампания независимо от кол-ва постов│
├─────────────────────────────────────────┤
│   [✓] Промпт кампания 1  ← выбрана      │
│   [ ] Промпт кампания 2  ← можно        │
│                          поменять выбор │
│   (Ready Post скрыты)                   │
├─────────────────────────────────────────┤
│   Выбрано 1 из 1 кампаний               │
│   [Далее →]                             │
└─────────────────────────────────────────┘
```

**Если вместо этого выбрали Ready Post:**

```
┌─────────────────────────────────────────┐
│   Выбран тип: готовый пост              │
├─────────────────────────────────────────┤
│   [✓] Ready Post 1  ← выбрана           │
│   [ ] Ready Post 2  ← можно добавить    │
│   (Промпт кампании скрыты)              │
├─────────────────────────────────────────┤
│   Выбрано 1 из 3 кампаний               │
│   [Далее →] (неактивна, нужно ещё 2)    │
└─────────────────────────────────────────┘
```

---

## Результат

- Промпт-кампании: всегда 1 кампания независимо от количества постов
- Ready Post кампании: количество кампаний = количеству постов
- Нельзя смешивать типы кампаний в одном заказе
- После выбора первой кампании — список фильтруется по её типу
- Понятные UI-подсказки о текущих правилах

