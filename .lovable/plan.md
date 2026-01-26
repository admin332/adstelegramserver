
## План: Обработка URL параметров для создания кампании с возвратом

### Проблема

1. Страница `/create` **не обрабатывает** URL параметры `?role=advertiser&action=new-campaign`
2. После создания кампании пользователь **не возвращается** на страницу выбора кампании в канале

### Что нужно сделать

1. **Create.tsx** — добавить обработку URL параметров через `useSearchParams`
2. **OrderDrawer.tsx** — передавать `channelId` при навигации
3. **CreateCampaignForm.tsx** — после создания кампании перенаправлять обратно на канал

### Файлы для изменения

| Файл | Изменения |
|------|-----------|
| `src/pages/Create.tsx` | Читать `role`, `action`, `returnTo` из URL и автоматически переходить к нужному шагу |
| `src/components/channel/OrderDrawer.tsx` | Добавить `channelId` prop и передавать его в URL |
| `src/pages/Channel.tsx` | Передавать `id` канала в OrderDrawer |
| `src/components/create/CreateCampaignForm.tsx` | Обрабатывать `returnTo` параметр и перенаправлять после создания |

### Детали реализации

**1. Create.tsx**
```tsx
import { useSearchParams, useNavigate } from 'react-router-dom';

// В компоненте
const [searchParams] = useSearchParams();
const navigate = useNavigate();

useEffect(() => {
  const role = searchParams.get('role');
  const action = searchParams.get('action');
  
  if (role === 'advertiser') {
    setSelectedRole('advertiser');
    if (action === 'new-campaign') {
      setCurrentStep('form');
    }
  } else if (role === 'channel_owner') {
    setSelectedRole('channel_owner');
    if (action === 'new-channel') {
      setCurrentStep('form');
    }
  }
}, [searchParams]);
```

**2. OrderDrawer.tsx**
```tsx
interface OrderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: string;  // Добавить
  channelName: string;
  pricePerPost: number;
}

const handleCreateNewCampaign = () => {
  onClose();
  navigate(`/create?role=advertiser&action=new-campaign&returnTo=/channel/${channelId}`);
};
```

**3. Channel.tsx**
```tsx
<OrderDrawer
  isOpen={isOrderDrawerOpen}
  onClose={() => setIsOrderDrawerOpen(false)}
  channelId={id!}  // Добавить
  channelName={channel.name}
  pricePerPost={channel.tonPrice}
/>
```

**4. CreateCampaignForm.tsx**
```tsx
import { useSearchParams, useNavigate } from 'react-router-dom';

// В компоненте
const [searchParams] = useSearchParams();
const navigate = useNavigate();

// После успешного создания
const returnTo = searchParams.get('returnTo');
if (returnTo) {
  navigate(returnTo);
} else {
  onComplete();
}
```

### Результат

1. При нажатии "Создать новую кампанию" в OrderDrawer → сразу открывается форма создания (шаг 1/3)
2. После создания кампании → пользователь возвращается на страницу канала
3. Drawer снова откроется и покажет список кампаний включая только что созданную
