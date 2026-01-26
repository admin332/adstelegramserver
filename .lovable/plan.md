

## Цель
Реализовать глобальное кеширование курса TON на клиенте с использованием React Query, чтобы все компоненты использовали единый кешированный курс.

## Текущая проблема

Сейчас каждый компонент, вызывающий `useTonPrice()`, создаёт:
- Отдельный `useState` для хранения курса
- Отдельный `useEffect` с запросом к edge function
- Отдельный `setInterval` для обновления каждые 5 минут

**Места использования:**
| Компонент | Файл |
|-----------|------|
| `Deals` (страница) | `src/pages/Deals.tsx` |
| `PaymentDialog` | `src/components/deals/PaymentDialog.tsx` |
| `PaymentStep` | `src/components/channel/PaymentStep.tsx` |
| `PostQuantitySelector` | `src/components/channel/PostQuantitySelector.tsx` |
| `AddChannelWizard` | `src/components/create/AddChannelWizard.tsx` |

## Решение

Переписать `useTonPrice` с использованием React Query (`@tanstack/react-query`), который уже установлен в проекте.

### Преимущества React Query:
- Автоматическое глобальное кеширование по ключу запроса
- Один запрос на все компоненты
- Автоматический refetch с настраиваемым интервалом
- Дедупликация запросов
- Встроенная обработка loading/error состояний

## Изменения

### 1. `src/hooks/useTonPrice.ts`

Переписать хук с использованием `useQuery`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

async function fetchTonPrice(): Promise<number> {
  const { data, error } = await supabase.functions.invoke('ton-price');
  if (error || !data?.price) {
    throw new Error('Не удалось получить курс TON');
  }
  return data.price;
}

export function useTonPrice() {
  const { data: tonPrice, isLoading: loading } = useQuery({
    queryKey: ['ton-price'],
    queryFn: fetchTonPrice,
    staleTime: 5 * 60 * 1000,      // Данные свежие 5 минут
    gcTime: 10 * 60 * 1000,        // Кеш хранится 10 минут
    refetchInterval: 5 * 60 * 1000, // Автообновление каждые 5 минут
    retry: 2,
  });

  const convertToUsd = (tonAmount: number): number | null => {
    if (!tonPrice) return null;
    return tonAmount * tonPrice;
  };

  return { tonPrice: tonPrice ?? null, loading, convertToUsd };
}
```

### Результат

После изменения:
- Все 5 компонентов будут использовать один кешированный курс
- Только 1 запрос к edge function вместо 5
- Курс синхронизирован между всеми элементами интерфейса
- Автоматическое обновление каждые 5 минут

Компоненты не требуют изменений — API хука остаётся прежним.

