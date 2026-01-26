
## План: Подключение реальных кампаний пользователя в OrderDrawer

### Текущая ситуация

Сейчас в шаге выбора кампании (`CampaignSelector`) используются mock данные из `mockCampaigns.ts`. При нажатии "Создать новую кампанию" просто выводится console.log.

### Что нужно сделать

1. **Подключить реальные кампании пользователя** вместо mock данных
2. **Перенаправлять на страницу создания** при нажатии "Создать новую кампанию"

### Файлы для изменения

| Файл | Изменения |
|------|-----------|
| `src/components/channel/OrderDrawer.tsx` | Подключить `useUserCampaigns`, передать navigate в компонент |
| `src/components/channel/CampaignSelector.tsx` | Обновить тип данных Campaign для работы с БД |

### Детали реализации

**1. OrderDrawer.tsx**

```tsx
// Добавить импорты
import { useNavigate } from 'react-router-dom';
import { useUserCampaigns, UserCampaign } from '@/hooks/useUserCampaigns';

// Удалить
import { mockCampaigns } from '@/data/mockCampaigns';

// В компоненте
const navigate = useNavigate();
const { data: userCampaigns = [], isLoading: campaignsLoading } = useUserCampaigns();

// Преобразовать данные из БД в формат для CampaignSelector
const campaigns = userCampaigns.map(c => ({
  id: c.id,
  name: c.name,
  imageUrl: c.image_url || '/placeholder.svg',
  text: c.text,
  buttonText: c.button_text || '',
  buttonUrl: c.button_url || '',
}));

// Обновить handleCreateNewCampaign
const handleCreateNewCampaign = () => {
  onClose();
  navigate('/create?role=advertiser&action=new-campaign');
};
```

**2. CampaignSelector.tsx**

Обновить интерфейс для поддержки опционального imageUrl:
```tsx
interface Campaign {
  id: string;
  name: string;
  imageUrl: string;
  text: string;
  buttonText: string;
  buttonUrl: string;
}
```

Добавить состояние загрузки и пустой список:
```tsx
// Если нет кампаний
{campaigns.length === 0 && (
  <div className="text-center py-8">
    <p className="text-muted-foreground">У вас пока нет кампаний</p>
    <p className="text-sm text-muted-foreground mt-1">Создайте первую кампанию</p>
  </div>
)}
```

### Результат

- В списке будут отображаться реальные кампании пользователя из базы данных
- При нажатии "Создать новую кампанию" → переход на `/create` с параметрами для открытия формы создания
- Если у пользователя нет кампаний → отображается сообщение с приглашением создать первую

### Технические детали

- `useUserCampaigns` уже использует `AuthContext` для получения user.id
- Кампании фильтруются по `owner_id = user.id` на уровне RLS
- URL `/create?role=advertiser&action=new-campaign` откроет страницу Create с нужными параметрами
