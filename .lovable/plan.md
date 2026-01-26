
## План: Улучшить превью кампаний в списке

### Что нужно сделать

1. **Показывать статичную картинку вместо видео** — для видеофайлов отображать иконку вместо проигрывания
2. **Добавить счётчик медиафайлов** — показывать количество материалов в кружке (если больше 1)

### Текущая ситуация

| Что сейчас | Что должно быть |
|------------|-----------------|
| Показывается только `image_url` | Показывать первый файл из `media_urls` |
| Видео не определяется | Определять тип по расширению файла |
| Нет счётчика | Показывать счётчик в правом нижнем углу |

---

### Файлы для изменения

| Файл | Действие | Описание |
|------|----------|----------|
| `src/hooks/useUserCampaigns.ts` | Изменить | Добавить `media_urls` в интерфейс и запрос |
| `src/components/create/MyCampaignsList.tsx` | Изменить | Добавить логику определения типа файла и счётчик |

---

### Техническая реализация

**1. Обновить интерфейс UserCampaign**

Добавить поле `media_urls`:

```typescript
export interface UserCampaign {
  id: string;
  name: string;
  text: string;
  button_text: string | null;
  button_url: string | null;
  image_url: string | null;
  media_urls: string[] | null;  // <-- Добавить
  is_active: boolean | null;
  created_at: string | null;
}
```

**2. Обновить логику отображения превью**

```typescript
// Вспомогательная функция для определения типа файла
const isVideoUrl = (url: string) => {
  const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.mkv'];
  return videoExtensions.some(ext => url.toLowerCase().includes(ext));
};

// В компоненте:
const mediaUrls = campaign.media_urls as string[] | null;
const firstMedia = mediaUrls?.[0] || campaign.image_url;
const mediaCount = mediaUrls?.length || (campaign.image_url ? 1 : 0);
const isVideo = firstMedia ? isVideoUrl(firstMedia) : false;
```

**3. Обновить JSX превью**

```tsx
<div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0 relative">
  {firstMedia ? (
    isVideo ? (
      // Для видео — показываем иконку
      <div className="w-full h-full flex items-center justify-center bg-card">
        <FileVideo className="w-6 h-6 text-primary" />
      </div>
    ) : (
      // Для фото — показываем картинку
      <img
        src={firstMedia}
        alt={campaign.name}
        className="w-full h-full object-cover"
      />
    )
  ) : (
    <ImageIcon className="w-6 h-6 text-muted-foreground" />
  )}
  
  {/* Счётчик медиафайлов (если больше 1) */}
  {mediaCount > 1 && (
    <div className="absolute bottom-0.5 right-0.5 min-w-5 h-5 rounded-full bg-primary flex items-center justify-center px-1">
      <span className="text-xs font-medium text-white">{mediaCount}</span>
    </div>
  )}
</div>
```

---

### Визуальный результат

```text
До изменений:
┌─────────────────────────────────────┐
│  [📷]  Название кампании      🔘   │
│        Текст рекламы...            │
└─────────────────────────────────────┘

После изменений (1 фото):
┌─────────────────────────────────────┐
│  [📷]  Название кампании      🔘   │
│        Текст рекламы...            │
└─────────────────────────────────────┘

После изменений (3 материала):
┌─────────────────────────────────────┐
│  [📷]  Название кампании      🔘   │
│   [3]  Текст рекламы...            │
└─────────────────────────────────────┘
     ↑
   Счётчик в правом нижнем углу превью

После изменений (видео):
┌─────────────────────────────────────┐
│  [🎬]  Название кампании      🔘   │
│        Текст рекламы...            │
└─────────────────────────────────────┘
     ↑
   Иконка видео вместо проигрывания
```
