
# Удаление переключателя из списка кампаний

## Проблема

В карточке кампании есть переключатель (Switch) для включения/выключения, но он избыточен — достаточно кнопки удаления.

## Что нужно удалить

**Файл:** `src/components/create/MyCampaignsList.tsx`

### 1. Удалить импорты (строки 2, 18, 20)

```tsx
// Удалить:
import { Switch } from "@/components/ui/switch";
import { useToggleCampaignActive } from "@/hooks/useUserCampaigns";
// UserCampaign больше не нужен для handleToggle
```

### 2. Удалить хук и функцию (строки 35, 38-43)

```tsx
// Удалить:
const toggleActive = useToggleCampaignActive();

const handleToggle = (campaign: UserCampaign) => {
  toggleActive.mutate({
    campaignId: campaign.id,
    isActive: !campaign.is_active,
  });
};
```

### 3. Удалить Switch компонент (строки 110-114)

```tsx
// Удалить:
<Switch
  checked={campaign.is_active || false}
  onCheckedChange={() => handleToggle(campaign)}
  disabled={toggleActive.isPending}
/>
```

## Результат

Карточка кампании станет проще:
- Заголовок кампании (без переключателя справа)
- Текст описания
- Нижняя панель с кнопкой удаления

## Изменяемые файлы

| Файл | Действие |
|------|----------|
| `src/components/create/MyCampaignsList.tsx` | Удалить Switch и связанный код |
