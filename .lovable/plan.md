

## Добавление фильтра по типу кампаний

Добавить возможность фильтрации каналов по типу принимаемых кампаний: "Все кампании", "По промту" или "Готовый пост".

---

## Изменения

### 1. `src/pages/Index.tsx`

**Добавить новое состояние для фильтра типа кампаний:**

```tsx
type CampaignTypeFilter = "all" | "prompt" | "ready_post";

const [campaignTypeFilter, setCampaignTypeFilter] = useState<CampaignTypeFilter>("all");
```

**Добавить новые FilterChip в блок фильтров (после "Рейтинг"):**

```tsx
import { FileText, Sparkles, PenTool } from "lucide-react";

// Внутри блока фильтров:
<FilterChip
  active={campaignTypeFilter === "all"}
  onClick={() => setCampaignTypeFilter("all")}
  icon={<Sparkles className="w-4 h-4" />}
>
  Все кампании
</FilterChip>
<FilterChip
  active={campaignTypeFilter === "prompt"}
  onClick={() => setCampaignTypeFilter("prompt")}
  icon={<PenTool className="w-4 h-4" />}
>
  По промту
</FilterChip>
<FilterChip
  active={campaignTypeFilter === "ready_post"}
  onClick={() => setCampaignTypeFilter("ready_post")}
  icon={<FileText className="w-4 h-4" />}
>
  Готовый пост
</FilterChip>
```

**Добавить фильтрацию в `filteredChannels`:**

```tsx
const matchesCampaignType = 
  campaignTypeFilter === "all" || 
  channel.acceptedCampaignTypes === "both" || 
  channel.acceptedCampaignTypes === campaignTypeFilter;

return matchesSearch && matchesCategory && matchesFavorites && matchesCampaignType;
```

---

### 2. `src/pages/Channels.tsx`

Аналогичные изменения:

**Добавить состояние:**
```tsx
type CampaignTypeFilter = "all" | "prompt" | "ready_post";

const [campaignTypeFilter, setCampaignTypeFilter] = useState<CampaignTypeFilter>("all");
```

**Добавить FilterChip и логику фильтрации (идентично Index.tsx).**

---

## Логика фильтрации

| Фильтр | Показываемые каналы |
|--------|---------------------|
| `all` | Все каналы |
| `prompt` | Каналы с `acceptedCampaignTypes = 'prompt'` или `'both'` |
| `ready_post` | Каналы с `acceptedCampaignTypes = 'ready_post'` или `'both'` |

---

## Иконки

| Тип | Иконка |
|-----|--------|
| Все кампании | `Sparkles` |
| По промту | `PenTool` |
| Готовый пост | `FileText` |

---

## Файлы для изменения

| Файл | Изменения |
|------|-----------|
| `src/pages/Index.tsx` | Добавить состояние, FilterChip, логику фильтрации |
| `src/pages/Channels.tsx` | Добавить состояние, FilterChip, логику фильтрации |

