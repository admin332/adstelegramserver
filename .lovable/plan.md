
# Отображение типа кампании в списке "Мои кампании"

## Текущий вид карточки

```
[Картинка]  Название кампании
            Текст кампании...

─────────────────────────────────
Кнопка: Подробнее              🗑️
```

## Новый вид карточки

```
[Картинка]  Название кампании
            Текст кампании...

─────────────────────────────────
Готовый пост   Кнопка: Подробнее   🗑️
```

или

```
[Картинка]  Название кампании
            Текст кампании...

─────────────────────────────────
Промпт   Кнопка: Подробнее         🗑️
```

## Изменения

### 1. Файл: `src/hooks/useUserCampaigns.ts`

Добавить поле `campaign_type` в интерфейс:

```tsx
export interface UserCampaign {
  id: string;
  name: string;
  text: string;
  button_text: string | null;
  button_url: string | null;
  image_url: string | null;
  media_urls: string[] | null;
  is_active: boolean | null;
  created_at: string | null;
  campaign_type: string;  // ← ДОБАВИТЬ
}
```

### 2. Файл: `src/components/create/MyCampaignsList.tsx`

Добавить отображение типа кампании в нижней части карточки (строка 105-109):

```tsx
<div className="flex items-center gap-2 pt-2 border-t border-secondary">
  {/* Тип кампании - НОВЫЙ ЭЛЕМЕНТ */}
  <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">
    {campaign.campaign_type === 'prompt' ? 'Промпт' : 'Готовый пост'}
  </span>
  
  {/* Существующая кнопка */}
  {campaign.button_text && (
    <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">
      Кнопка: {campaign.button_text}
    </span>
  )}
  <div className="flex-1" />
  {/* ... delete button ... */}
</div>
```

## Стилизация

Тип кампании будет отображаться точно так же, как "Кнопка: ..." — серый бейдж с закруглёнными краями:
- `text-xs` — мелкий текст
- `text-muted-foreground` — приглушённый цвет
- `bg-secondary` — фон
- `px-2 py-1` — отступы
- `rounded-full` — полностью закруглённые углы

## Значения типов

| В базе данных | Отображение |
|---------------|-------------|
| `ready_post`  | Готовый пост |
| `prompt`      | Промпт |
