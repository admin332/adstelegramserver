

## План: Отображение суммы в USD рядом с ценой в TON

### Обзор

Добавим отображение эквивалента в долларах справа от каждого поля ввода цены в TON. Курс TON/USD будет загружаться с CoinGecko API через edge function с кешированием на 5 минут (Cache-Aside стратегия).

### Архитектура

```text
┌─────────────────────────────────────────────────────────────┐
│                   AddChannelWizard                          │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │ Input: 50 TON   │    │ Input: 40 TON   │                │
│  │ ≈ $125 USD      │    │ ≈ $100 USD      │                │
│  └─────────────────┘    └─────────────────┘                │
│            ↓                    ↓                           │
│   useTonPrice() hook — кеширует курс на клиенте            │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              Edge Function: ton-price                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Lazy Caching (5 минут)                              │  │
│  │  - Проверяет кеш в памяти                            │  │
│  │  - Если устарел → запрос к CoinGecko                 │  │
│  │  - Возвращает { price: 2.50 }                        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

### Изменения

#### 1. Создать Edge Function `supabase/functions/ton-price/index.ts`

Реализует Cache-Aside стратегию с кешированием на 5 минут:

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let cachedTonData = {
  price: null as number | null,
  expiresAt: 0
};

async function getTonPriceOnDemand(): Promise<number> {
  const now = Date.now();

  // Если кеш актуален — возвращаем
  if (cachedTonData.price && now < cachedTonData.expiresAt) {
    console.log("Курс TON из кеша:", cachedTonData.price);
    return cachedTonData.price;
  }

  // Иначе запрос к CoinGecko
  try {
    console.log("Запрос курса TON к CoinGecko...");
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd'
    );
    const data = await response.json();
    const price = data['the-open-network'].usd;

    // Обновляем кеш на 5 минут
    cachedTonData = {
      price: price,
      expiresAt: now + (5 * 60 * 1000)
    };

    return price;
  } catch (error) {
    console.error("Ошибка API CoinGecko:", error);
    return cachedTonData.price || 2.5; // Fallback
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const price = await getTonPriceOnDemand();
  
  return new Response(
    JSON.stringify({ price }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
```

#### 2. Обновить `supabase/config.toml`

Добавить конфигурацию для новой функции:

```toml
[functions.ton-price]
verify_jwt = false
```

#### 3. Создать хук `src/hooks/useTonPrice.ts`

Кеширует курс на клиенте и автоматически обновляет:

```typescript
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useTonPrice() {
  const [tonPrice, setTonPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('ton-price');
        if (!error && data?.price) {
          setTonPrice(data.price);
        }
      } catch (e) {
        console.error('Ошибка получения курса TON:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchPrice();
    
    // Обновлять каждые 5 минут
    const interval = setInterval(fetchPrice, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const convertToUsd = (tonAmount: number): number | null => {
    if (!tonPrice) return null;
    return tonAmount * tonPrice;
  };

  return { tonPrice, loading, convertToUsd };
}
```

#### 4. Обновить `src/components/create/AddChannelWizard.tsx`

Добавить отображение USD справа от инпутов:

**Импорт хука:**
```typescript
import { useTonPrice } from '@/hooks/useTonPrice';
```

**Использование в компоненте:**
```typescript
const { tonPrice, convertToUsd } = useTonPrice();
```

**Изменить разметку полей цен (строки 249-270):**

```tsx
<div className="space-y-2">
  <Label>Стоимость размещения (TON за пост)</Label>
  <div className="grid grid-cols-2 gap-3">
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">1/24</span>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          placeholder="0"
          value={channelData.price_1_24}
          onChange={(e) => setChannelData({ ...channelData, price_1_24: e.target.value })}
          className="bg-card border-0"
        />
        {channelData.price_1_24 && tonPrice && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            ≈ ${(parseFloat(channelData.price_1_24) * tonPrice).toFixed(2)}
          </span>
        )}
      </div>
    </div>
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">2+/24</span>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          placeholder="0"
          value={channelData.price_2_48}
          onChange={(e) => setChannelData({ ...channelData, price_2_48: e.target.value })}
          className="bg-card border-0"
        />
        {channelData.price_2_48 && tonPrice && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            ≈ ${(parseFloat(channelData.price_2_48) * tonPrice).toFixed(2)}
          </span>
        )}
      </div>
    </div>
  </div>
</div>
```

---

### Файлы для создания/изменения

| Файл | Действие |
|------|----------|
| `supabase/functions/ton-price/index.ts` | Создать |
| `supabase/config.toml` | Добавить `[functions.ton-price]` |
| `src/hooks/useTonPrice.ts` | Создать |
| `src/components/create/AddChannelWizard.tsx` | Изменить |

---

### Преимущества решения

- **Экономия ресурсов**: Edge function не делает запросы, пока никто не заходит в приложение
- **Скорость**: Курс кешируется на 5 минут, повторные запросы мгновенные
- **Защита от Rate Limit**: Максимум 12 запросов в час к CoinGecko
- **Fallback**: При ошибке API используется последний известный курс или дефолтное значение

