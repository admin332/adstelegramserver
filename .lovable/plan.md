

## План: Исправление таймеров и отображение обратного отсчёта 24ч

### Выявленные проблемы

| Проблема | Текущее поведение | Ожидаемое |
|----------|-------------------|-----------|
| `draft_submitted_at` не сбрасывается | При запросе доработки старое время остаётся → возможен ложный 24ч таймаут | Сбрасывать в `null` при запросе доработки |
| API не возвращает таймстампы | `user-deals` не возвращает `draft_submitted_at`, `payment_verified_at` | Добавить эти поля в ответ |
| Нет таймера 24ч в UI | Пользователь не видит сколько времени осталось | Показывать обратный отсчёт |

---

### 1. Исправление сброса `draft_submitted_at` при доработке

**Файл:** `supabase/functions/telegram-webhook/index.ts`

В функции `handleRevisionComment` (около строки 796-808) добавить сброс `draft_submitted_at`:

```typescript
const { error: updateError } = await supabase
  .from("deals")
  .update({
    is_draft_approved: false,
    author_draft: null,
    author_draft_entities: [],
    author_draft_media: [],
    author_draft_media_urls: [],
    author_drafts: [],
    draft_history: currentHistory,
    revision_count: (deal.revision_count || 0) + 1,
    draft_submitted_at: null,  // ← ДОБАВИТЬ: сброс таймера
  })
  .eq("id", dealId);
```

Это гарантирует, что таймер 24ч на ответ рекламодателя начнётся заново только после отправки нового черновика.

---

### 2. Добавление полей в API `user-deals`

**Файл:** `supabase/functions/user-deals/index.ts`

Добавить в select:
```typescript
.select(`
  id,
  status,
  ...
  draft_submitted_at,      // ← ДОБАВИТЬ
  payment_verified_at,     // ← ДОБАВИТЬ
  ...
`)
```

Добавить в transform:
```typescript
return {
  ...
  draft_submitted_at: deal.draft_submitted_at,
  payment_verified_at: deal.payment_verified_at,
  ...
}
```

---

### 3. Обновление типа Deal в хуке

**Файл:** `src/hooks/useUserDeals.ts`

Добавить новые поля в интерфейс:
```typescript
export interface Deal {
  ...
  draft_submitted_at: string | null;
  payment_verified_at: string | null;
  ...
}
```

---

### 4. Добавление таймеров в DealCard

**Файл:** `src/components/DealCard.tsx`

Добавить пропсы:
```typescript
interface DealCardProps {
  ...
  draftSubmittedAt: string | null;
  paymentVerifiedAt: string | null;
  ...
}
```

Логика отображения таймеров:

```typescript
// Рассчитать дедлайны
const deadline24hFromPayment = paymentVerifiedAt 
  ? new Date(new Date(paymentVerifiedAt).getTime() + 24 * 60 * 60 * 1000).toISOString()
  : null;

const deadline24hFromDraft = draftSubmittedAt 
  ? new Date(new Date(draftSubmittedAt).getTime() + 24 * 60 * 60 * 1000).toISOString()
  : null;

// Таймер для владельца канала: "24ч на отправку черновика" (после оплаты, пока нет черновика)
const showOwnerDraftDeadline = 
  status === "escrow" && 
  isPromptCampaign && 
  isChannelOwner && 
  !authorDraft && 
  deadline24hFromPayment &&
  new Date(deadline24hFromPayment).getTime() > Date.now();

// Таймер для рекламодателя: "24ч на проверку" (после получения черновика)
const showAdvertiserReviewDeadline = 
  status === "escrow" && 
  isPromptCampaign && 
  !isChannelOwner && 
  authorDraft && 
  isDraftApproved === null &&
  deadline24hFromDraft &&
  new Date(deadline24hFromDraft).getTime() > Date.now();

// Таймер для владельца в режиме доработки (пока нет нового черновика)
const showOwnerRevisionDeadline = 
  status === "escrow" && 
  isPromptCampaign && 
  isChannelOwner && 
  isDraftApproved === false && 
  !authorDraft &&
  deadline24hFromPayment &&  // Используем payment_verified_at так как draft_submitted_at сброшен
  new Date(deadline24hFromPayment).getTime() > Date.now();
```

Отображение:
```tsx
{/* Таймер 24ч для владельца - отправить черновик */}
{showOwnerDraftDeadline && (
  <div className="absolute top-4 right-4">
    <DealCountdown 
      targetDate={deadline24hFromPayment!} 
      label="на черновик"
      colorClass="text-yellow-500"
    />
  </div>
)}

{/* Таймер 24ч для рекламодателя - проверить черновик */}
{showAdvertiserReviewDeadline && (
  <div className="absolute top-4 right-4">
    <DealCountdown 
      targetDate={deadline24hFromDraft!} 
      label="на проверку"
      colorClass="text-yellow-500"
    />
  </div>
)}
```

---

### 5. Передача новых пропсов в Deals.tsx

**Файл:** `src/pages/Deals.tsx`

```tsx
<DealCard 
  ...
  draftSubmittedAt={deal.draft_submitted_at}
  paymentVerifiedAt={deal.payment_verified_at}
  ...
/>
```

---

### Итоговый UX

| Роль | Стадия | Таймер |
|------|--------|--------|
| Владелец | Оплачено, черновик не отправлен | "24ч на черновик" (желтый) |
| Владелец | На доработке | "24ч на черновик" (желтый) |
| Рекламодатель | Черновик получен, не проверен | "24ч на проверку" (желтый) |
| Рекламодатель | После одобрения | "До публикации" (синий) |
| Оба | После публикации | "До завершения" (зеленый) |

---

### Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `supabase/functions/telegram-webhook/index.ts` | Сброс `draft_submitted_at: null` при доработке |
| `supabase/functions/user-deals/index.ts` | Добавить `draft_submitted_at`, `payment_verified_at` |
| `src/hooks/useUserDeals.ts` | Добавить типы |
| `src/components/DealCard.tsx` | Добавить таймеры 24ч |
| `src/pages/Deals.tsx` | Передать новые пропсы |

