

## Задача

Для входящих сделок (роль `channel_owner`) заменить отображение данных рекламодателя на данные кампании:
- **Аватарка** → превью первого медиафайла кампании
- **Имя** → название кампании
- **Никнейм** → убрать полностью

Это обеспечивает конфиденциальность рекламодателей.

## Текущее состояние

```typescript
// DealCard.tsx — строки 113-123
const displayTitle = isChannelOwner 
  ? advertiser?.first_name || "Рекламодатель"  // ❌ показывает имя
  : channel?.title || "Канал";
const displaySubtitle = isChannelOwner 
  ? advertiser?.username ? `@${advertiser.username}` : null  // ❌ показывает ник
  : channel?.username;
const displayAvatar = isChannelOwner 
  ? advertiser?.photo_url  // ❌ показывает аватар Telegram
  : channel?.avatar_url;
```

## Решение

### Часть 1: Edge Function — расширить данные кампании

Добавить `media_urls` и `image_url` в запрос campaigns + убрать сбор advertiser данных:

```typescript
// supabase/functions/user-deals/index.ts
campaign:campaigns(id, name, media_urls, image_url)

// Убрать код сбора advertiser info (строки 137-156)
// advertiser: undefined для всех channel_owner сделок
```

### Часть 2: Обновить типы в useUserDeals.ts

```typescript
campaign: {
  id: string;
  name: string;
  media_urls?: string[];  // добавить
  image_url?: string;     // добавить
} | null;
// Убрать advertiser из интерфейса Deal
```

### Часть 3: DealCard — показывать кампанию вместо рекламодателя

```typescript
// Для channel_owner:
const displayTitle = campaign?.name || "Кампания";  // название кампании
const displaySubtitle = null;  // убрать ник полностью
const displayAvatar = getMediaPreview(campaign);  // превью медиа

// Функция получения превью
function getMediaPreview(campaign) {
  if (campaign?.media_urls?.length > 0) {
    return campaign.media_urls[0];
  }
  return campaign?.image_url || null;
}
```

## Файлы для изменения

| Файл | Изменения |
|------|-----------|
| `supabase/functions/user-deals/index.ts` | Добавить `media_urls, image_url` в campaigns, убрать advertiser |
| `src/hooks/useUserDeals.ts` | Обновить тип campaign, убрать advertiser |
| `src/components/DealCard.tsx` | Показывать кампанию для channel_owner |

## Визуальный результат

**Было (для channel_owner):**
```
[Аватар TG] Иван Петров
            @ivanpetrov
            Кампания: Летняя акция
            Канал: @mychannel
```

**Станет:**
```
[Превью медиа] Летняя акция
               входящий
               Канал: @mychannel
```

## Техническая реализация

### user-deals/index.ts

```typescript
// Строка 116: расширить campaign select
campaign:campaigns(id, name, media_urls, image_url)

// Удалить строки 137-156 (сбор advertiser данных)
// В transformedDeals убрать advertiser: ...
```

### useUserDeals.ts

```typescript
campaign: {
  id: string;
  name: string;
  media_urls?: string[];
  image_url?: string;
} | null;
// Удалить advertiser из Deal interface
```

### DealCard.tsx

```typescript
// Убрать advertiser из props
// Обновить логику displayTitle/displayAvatar:

const getCampaignPreviewImage = (campaign: DealCardProps['campaign']) => {
  if (!campaign) return null;
  const mediaUrls = (campaign as any).media_urls;
  if (Array.isArray(mediaUrls) && mediaUrls.length > 0) {
    const firstMedia = mediaUrls[0];
    // Проверяем что это изображение, не видео
    if (!firstMedia.includes('.mp4') && !firstMedia.includes('.mov')) {
      return firstMedia;
    }
  }
  return (campaign as any).image_url || null;
};

const displayTitle = isChannelOwner 
  ? campaign?.name || "Кампания"
  : channel?.title || "Канал";
  
const displaySubtitle = isChannelOwner 
  ? null  // убрать полностью
  : channel?.username;
  
const displayAvatar = isChannelOwner 
  ? getCampaignPreviewImage(campaign)
  : channel?.avatar_url;
```

## Обработка видео

Если первый медиафайл — видео (.mp4, .mov), показываем fallback-иконку кампании вместо превью.

