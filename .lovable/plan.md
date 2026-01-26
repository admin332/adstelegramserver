
## Задача

Исправить отображение материала кампании в аватарке карточки сделки для владельцев каналов, сделав его аналогичным отображению в разделе "Мои кампании".

## Проблема

В `DealCard.tsx` используется компонент `Avatar` с простым fallback (только буква), тогда как в `MyCampaignsList.tsx` используется квадратный блок с:
- Отображением изображения
- Иконкой `FileVideo` для видео
- Иконкой `ImageIcon` если нет медиа
- Бейджем с количеством медиафайлов

## Решение

Заменить для `isChannelOwner` стандартный `Avatar` на квадратный блок превью аналогичный `MyCampaignsList`:

### DealCard.tsx — изменения

```typescript
// Добавить импорты
import { ImageIcon, FileVideo } from "lucide-react";

// Добавить функцию проверки видео
const isVideoUrl = (url: string) => {
  const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.mkv'];
  return videoExtensions.some(ext => url.toLowerCase().includes(ext));
};

// Получить данные для превью кампании
const getCampaignMediaInfo = (campaign: DealCardProps['campaign']) => {
  if (!campaign) return { firstMedia: null, mediaCount: 0, isVideo: false };
  
  const mediaUrls = campaign.media_urls as string[] | undefined;
  const firstMedia = mediaUrls?.[0] || campaign.image_url || null;
  const mediaCount = mediaUrls?.length || (campaign.image_url ? 1 : 0);
  const isVideo = firstMedia ? isVideoUrl(firstMedia) : false;
  
  return { firstMedia, mediaCount, isVideo };
};
```

### Логика рендеринга аватара

Для `isChannelOwner` вместо `<Avatar>` использовать квадратный блок:

```tsx
{isChannelOwner ? (
  // Превью кампании как в MyCampaignsList
  <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0 relative">
    {campaignMedia.firstMedia ? (
      campaignMedia.isVideo ? (
        <div className="w-full h-full flex items-center justify-center bg-card">
          <FileVideo className="w-5 h-5 text-primary" />
        </div>
      ) : (
        <img
          src={campaignMedia.firstMedia}
          alt={displayTitle}
          className="w-full h-full object-cover"
        />
      )
    ) : (
      <ImageIcon className="w-5 h-5 text-muted-foreground" />
    )}
    {campaignMedia.mediaCount > 1 && (
      <div className="absolute bottom-0.5 right-0.5 min-w-4 h-4 rounded-full bg-primary flex items-center justify-center px-0.5">
        <span className="text-[10px] font-medium text-primary-foreground">{campaignMedia.mediaCount}</span>
      </div>
    )}
  </div>
) : (
  // Стандартный Avatar для канала (для рекламодателя)
  <Avatar className="w-12 h-12">
    <AvatarImage src={displayAvatar || undefined} alt={displayTitle} />
    <AvatarFallback className="bg-secondary text-foreground">
      {displayInitial}
    </AvatarFallback>
  </Avatar>
)}
```

## Файлы для изменения

| Файл | Изменения |
|------|-----------|
| `src/components/DealCard.tsx` | Добавить `isVideoUrl`, `getCampaignMediaInfo`, условный рендеринг превью |

## Визуальный результат

**Было (для channel_owner):**
```
[К] Летняя акция    ← круглый аватар с буквой
    входящий
    Канал: @mychannel
```

**Станет:**
```
[🖼️] Летняя акция   ← квадратное превью с изображением/видео-иконкой
 [3]  входящий       ← бейдж количества если несколько медиа
     Канал: @mychannel
```

## Приватность

Изменение затрагивает только роль `channel_owner` — рекламодатели (`advertiser`) продолжают видеть аватарку канала. Материал кампании виден только владельцам канала и их команде (менеджерам), так как эти данные уже отфильтрованы по роли в edge function.
