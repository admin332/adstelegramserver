
# Изменение дизайна всплывающих окон (Dialog/AlertDialog)

## Текущий дизайн

Сейчас диалоговые окна имеют:
- **Overlay**: `bg-black/80` — только затемнение без размытия
- **Content**: `border bg-background` — белый/тёмный фон с рамкой

## Новый дизайн

Требуется:
- Убрать фон блока контента
- Убрать рамку обводки
- Добавить размытие заднего фона (blur) вместо просто затемнения

## Изменяемые файлы

### 1. `src/components/ui/dialog.tsx`

**DialogOverlay** (строки 18-27):
```tsx
// Было:
"fixed inset-0 z-50 bg-black/80 ..."

// Станет:
"fixed inset-0 z-50 bg-black/40 backdrop-blur-xl ..."
```

**DialogContent** (строки 36-41):
```tsx
// Было:
"... border bg-background p-6 shadow-lg ... sm:rounded-lg"

// Станет:
"... border-0 bg-transparent p-6 ... sm:rounded-lg"
```

### 2. `src/components/ui/alert-dialog.tsx`

**AlertDialogOverlay** (строки 17-24):
```tsx
// Было:
"fixed inset-0 z-50 bg-black/80 ..."

// Станет:
"fixed inset-0 z-50 bg-black/40 backdrop-blur-xl ..."
```

**AlertDialogContent** (строки 34-40):
```tsx
// Было:
"... border bg-background p-6 shadow-lg ... sm:rounded-lg"

// Станет:
"... border-0 bg-transparent p-6 ... sm:rounded-lg"
```

## Визуальный результат

```text
┌─────────────────────────────────────────┐
│                                         │
│        ┌───────────────────┐            │
│        │   Подтверждение   │            │
│        │                   │  ← Прозрачный фон,
│        │  Текст диалога    │    без рамки
│        │                   │            │
│        │  [Отмена] [OK]    │            │
│        └───────────────────┘            │
│                                         │
│    ← Размытие всего фона (blur-xl)      │
│      + лёгкое затемнение (40%)          │
└─────────────────────────────────────────┘
```

## Технические детали

| Параметр | Было | Станет |
|----------|------|--------|
| Overlay фон | `bg-black/80` | `bg-black/40` |
| Overlay blur | Нет | `backdrop-blur-xl` |
| Content фон | `bg-background` | `bg-transparent` |
| Content рамка | `border` | `border-0` |
| Content тень | `shadow-lg` | Убрать |

## Затронутые компоненты

Все диалоги в приложении автоматически получат новый стиль:
- PaymentDialog
- ScheduleEditDialog
- DraftEditorDialog
- DraftReviewDialog
- OwnerActionsDialog
- AlertDialog подтверждения удаления кампании
- Другие диалоги

## Примечание

Размытие `backdrop-blur-xl` (24px) обеспечит хорошую видимость анимированного starfield фона через overlay, сохраняя фокус на содержимом диалога.
