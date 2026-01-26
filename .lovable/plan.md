

## Задача

Добавить обратный отсчёт в карточку сделки для статусов:
1. **escrow/in_progress** — обратный отсчёт до публикации (`scheduled_at`) с подписью "до публикации"
2. **in_progress** (после публикации) — обратный отсчёт до завершения (`posted_at` + `duration_hours`) с подписью "до завершения"

Таймер отображается в правом верхнем углу карточки (как при ожидании оплаты) и виден обеим сторонам.

## Текущее состояние

```typescript
// DealCard.tsx — строки 160-165
{status === "pending" && expiresAt && (
  <div className="absolute top-4 right-4">
    <ExpirationTimer expiresAt={expiresAt} />
  </div>
)}
```

Таймер показывается только для `pending` статуса. Для остальных статусов таймера нет.

## Решение

### Часть 1: Расширить Edge Function

Добавить `posted_at` в запрос deals:

```typescript
// supabase/functions/user-deals/index.ts — строка 103-118
.select(`
  id,
  status,
  ...
  posted_at,  // ← добавить
  ...
`)
```

И включить в transformedDeals.

### Часть 2: Обновить типы

```typescript
// src/hooks/useUserDeals.ts
export interface Deal {
  ...
  posted_at: string | null;  // ← добавить
}

// src/components/DealCard.tsx (props)
postedAt: string | null;  // ← добавить
```

### Часть 3: Создать компонент DealCountdown

Новый универсальный компонент для отображения обратного отсчёта с подписью:

```typescript
// src/components/deals/DealCountdown.tsx
interface DealCountdownProps {
  targetDate: string;
  label: string;
  colorClass?: string;
}

export function DealCountdown({ targetDate, label, colorClass = "text-primary" }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isExpired, setIsExpired] = useState(false);
  
  useEffect(() => {
    const update = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      
      if (diff <= 0) {
        setIsExpired(true);
        return;
      }
      
      // Форматирование: часы:минуты:секунды или дни
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      
      if (hours >= 24) {
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        setTimeLeft(`${days}д ${remainingHours}ч`);
      } else {
        setTimeLeft(`${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      }
    };
    
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);
  
  if (isExpired) return null;
  
  return (
    <div className="flex flex-col items-end">
      <span className={cn("flex items-center gap-1 text-sm font-medium", colorClass)}>
        <Clock className="w-3.5 h-3.5" />
        {timeLeft}
      </span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
```

### Часть 4: Обновить DealCard

Добавить логику определения какой таймер показывать:

```typescript
// DealCard.tsx

// Вычисляем время завершения (posted_at + duration_hours)
const completionTime = postedAt 
  ? new Date(new Date(postedAt).getTime() + durationHours * 60 * 60 * 1000).toISOString()
  : null;

// Определяем что показывать
const showPublicationCountdown = 
  (status === "escrow" || status === "in_progress") && 
  scheduledAt && 
  new Date(scheduledAt).getTime() > Date.now();

const showCompletionCountdown = 
  status === "in_progress" && 
  postedAt && 
  completionTime &&
  new Date(completionTime).getTime() > Date.now();

// Рендеринг в правом верхнем углу
{status === "pending" && expiresAt && (
  <div className="absolute top-4 right-4">
    <ExpirationTimer expiresAt={expiresAt} />
  </div>
)}

{showPublicationCountdown && (
  <div className="absolute top-4 right-4">
    <DealCountdown 
      targetDate={scheduledAt!} 
      label="до публикации"
      colorClass="text-blue-500"
    />
  </div>
)}

{showCompletionCountdown && (
  <div className="absolute top-4 right-4">
    <DealCountdown 
      targetDate={completionTime!} 
      label="до завершения"
      colorClass="text-primary"
    />
  </div>
)}
```

## Файлы для изменения

| Файл | Изменения |
|------|-----------|
| `supabase/functions/user-deals/index.ts` | Добавить `posted_at` в select и transform |
| `src/hooks/useUserDeals.ts` | Добавить `posted_at` в интерфейс Deal |
| `src/components/deals/DealCountdown.tsx` | Создать новый компонент |
| `src/components/DealCard.tsx` | Добавить prop `postedAt`, логику таймеров |
| `src/pages/Deals.tsx` | Передать `postedAt` в DealCard |

## Визуальный результат

```text
┌─────────────────────────────────────┐
│ [Превью] Летняя акция    2:45:30   │ ← часы:мин:сек
│          входящий      до публикации│ ← подпись
│          Канал: @mychannel          │
│                                     │
│ 5 TON ≈ $15.00 • 2 поста • 24ч     │
│─────────────────────────────────────│
│ 🔵 Оплачено              2 дня назад│
└─────────────────────────────────────┘

После публикации:
┌─────────────────────────────────────┐
│ [Превью] Летняя акция    23:15:42  │
│          входящий      до завершения│
│          Канал: @mychannel          │
│─────────────────────────────────────│
│ 🟢 Публикуется           5 мин назад│
└─────────────────────────────────────┘
```

## Логика переключения таймеров

```text
escrow (до scheduled_at)     → "до публикации" (blue)
in_progress (до scheduled_at) → "до публикации" (blue)
in_progress (после posted_at) → "до завершения" (primary/green)
completed                      → без таймера
```

## Техническая детализация

### Форматирование времени

- **Менее 24 часов**: `HH:MM:SS` (например `2:45:30`)
- **24+ часов**: `Xд Yч` (например `2д 5ч`)

### Цветовая схема

- Ожидание оплаты: `text-yellow-500`
- До публикации: `text-blue-500`
- До завершения: `text-primary` (зелёный)

