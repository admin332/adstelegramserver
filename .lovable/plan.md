

## Цель
Реализовать реальное отображение сделок пользователя на странице `/deals` с действиями в зависимости от статуса

## Статусы сделок и их логика

| Статус | Описание | Действия пользователя |
|--------|----------|----------------------|
| `pending` | Создана, не оплачена | Кнопка "Оплатить", "Посмотреть в блокчейне" |
| `escrow` | Оплачена, средства на эскроу | "Посмотреть в блокчейне", ожидание публикации |
| `in_progress` | Пост опубликован | Таймер до завершения |
| `completed` | Завершена успешно | Оставить отзыв (если не оставлен) |
| `cancelled` | Отменена | Только просмотр |
| `disputed` | Спор | Связаться с поддержкой |

## Изменения

### 1. Создать хук `useUserDeals.ts`

**Файл**: `src/hooks/useUserDeals.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Deal {
  id: string;
  status: 'pending' | 'escrow' | 'in_progress' | 'completed' | 'cancelled' | 'disputed';
  total_price: number;
  posts_count: number;
  duration_hours: number;
  escrow_address: string | null;
  scheduled_at: string | null;
  created_at: string;
  channel: {
    id: string;
    title: string;
    avatar_url: string | null;
    username: string;
  };
  campaign: {
    id: string;
    name: string;
  } | null;
}

export function useUserDeals() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['user-deals', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('deals')
        .select(`
          id,
          status,
          total_price,
          posts_count,
          duration_hours,
          escrow_address,
          scheduled_at,
          created_at,
          channel:channels(id, title, avatar_url, username),
          campaign:campaigns(id, name)
        `)
        .eq('advertiser_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Deal[];
    },
    enabled: !!user?.id,
  });
}
```

### 2. Обновить компонент `DealCard.tsx`

**Файл**: `src/components/DealCard.tsx`

Добавить:
- Кнопку "Оплатить" для статуса `pending` (открывает диалог оплаты)
- Кнопку "Посмотреть в блокчейне" (ссылка на tonviewer)
- Различное отображение в зависимости от статуса
- Отображение цены в TON с конвертацией в USD

```typescript
// Новые пропсы
interface DealCardProps {
  id: string;
  status: DealStatus;
  totalPrice: number;       // в TON
  postsCount: number;
  escrowAddress: string | null;
  scheduledAt: string | null;
  createdAt: string;
  channel: {
    title: string;
    avatar_url: string | null;
    username: string;
  };
  campaign: { name: string } | null;
  onPayClick?: () => void;
}
```

Визуальная структура карточки:

```
┌──────────────────────────────────────────┐
│ [Avatar] Название канала                 │
│          @username                       │
│          Кампания: "Название"            │
│                                          │
│ 💎 50 TON  •  1 пост  •  24ч            │
├──────────────────────────────────────────┤
│ 🟡 Ожидает оплаты          2 часа назад │
│                                          │
│ [ Оплатить ]  [ В блокчейне ]           │ ← только для pending
└──────────────────────────────────────────┘
```

### 3. Создать компонент `PaymentDialog.tsx`

**Файл**: `src/components/deals/PaymentDialog.tsx`

Диалог для оплаты сделки:
- Показывает сумму к оплате
- Показывает эскроу-адрес
- Кнопка "Оплатить" через TonConnect
- Кнопка "Посмотреть в блокчейне"

Использует ту же логику, что и `PaymentStep.tsx`:
```typescript
const handlePayViaWallet = async () => {
  const amountNano = (totalPrice * 1_000_000_000).toString();
  
  await tonConnectUI.sendTransaction({
    validUntil: Math.floor(Date.now() / 1000) + 600,
    messages: [{ address: escrowAddress, amount: amountNano }]
  });
};
```

### 4. Обновить страницу `Deals.tsx`

**Файл**: `src/pages/Deals.tsx`

- Заменить `mockDeals` на реальные данные из `useUserDeals()`
- Добавить состояния загрузки и ошибок
- Добавить диалог оплаты
- Обновить фильтрацию под новые статусы

```typescript
const Deals = () => {
  const { data: deals, isLoading, error, refetch } = useUserDeals();
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [filter, setFilter] = useState<DealFilter>("all");
  
  // Фильтры
  const filters = [
    { id: "all", label: "Все", icon: Inbox },
    { id: "pending", label: "К оплате", icon: Wallet },
    { id: "active", label: "Активные", icon: Clock },
    { id: "completed", label: "Завершённые", icon: CheckCircle2 },
  ];
  
  // ...
};
```

### 5. Обновить конфигурацию статусов

Новая конфигурация с учётом реальных статусов из базы:

```typescript
const statusConfig = {
  pending: { 
    label: "Ожидает оплаты", 
    color: "text-yellow-500", 
    bgColor: "bg-yellow-500/10",
    icon: Wallet 
  },
  escrow: { 
    label: "Оплачено", 
    color: "text-blue-500", 
    bgColor: "bg-blue-500/10",
    icon: Shield 
  },
  in_progress: { 
    label: "Публикуется", 
    color: "text-primary", 
    bgColor: "bg-primary/10",
    icon: Clock 
  },
  completed: { 
    label: "Завершено", 
    color: "text-green-500", 
    bgColor: "bg-green-500/10",
    icon: CheckCircle2 
  },
  cancelled: { 
    label: "Отменено", 
    color: "text-red-500", 
    bgColor: "bg-red-500/10",
    icon: XCircle 
  },
  disputed: { 
    label: "Спор", 
    color: "text-orange-500", 
    bgColor: "bg-orange-500/10",
    icon: AlertTriangle 
  },
};
```

## Файлы для создания/изменения

| Файл | Действие |
|------|----------|
| `src/hooks/useUserDeals.ts` | Создать |
| `src/components/deals/PaymentDialog.tsx` | Создать |
| `src/components/DealCard.tsx` | Переписать |
| `src/pages/Deals.tsx` | Обновить |

## Результат

1. Пользователь видит свои реальные сделки из базы данных
2. Для неоплаченных сделок (pending) — кнопки "Оплатить" и "В блокчейне"
3. Для оплаченных (escrow) — информация об ожидании публикации
4. Для завершённых (completed) — возможность оставить отзыв
5. Корректное форматирование дат на русском языке
6. Цены в TON с USD эквивалентом

