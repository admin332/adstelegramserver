
## План: Загрузка до 10 медиафайлов на втором шаге создания кампании

### Текущая ситуация

Сейчас на втором шаге создания кампании можно загрузить только **1 файл**:
- Используется `mediaFile: File | null` (одиночный файл)
- В БД хранится `image_url: string | null` (одна ссылка)
- Edge function принимает `image_url` как строку

### Что нужно сделать

Реализовать загрузку до **10 фото/видео** в стиле Instagram:
- Отображать сетку превью загруженных файлов
- Проверка лимита 50 МБ на каждый файл
- Поддержка drag & drop (опционально)
- Возможность удаления любого файла из списка

### Файлы для изменения

| Файл | Изменения |
|------|-----------|
| База данных | Добавить колонку `media_urls JSONB` (массив URL) |
| `src/components/create/CreateCampaignForm.tsx` | Переписать Step 2 для множественной загрузки |
| `supabase/functions/create-campaign/index.ts` | Обновить для приёма массива `media_urls` |
| `src/components/channel/CampaignSelector.tsx` | Отображать первое изображение из массива |
| `src/components/channel/OrderDrawer.tsx` | Преобразовать `media_urls` для компонента |

---

### 1. Миграция базы данных

```sql
-- Добавить новую колонку для массива медиа
ALTER TABLE public.campaigns 
ADD COLUMN media_urls JSONB DEFAULT '[]'::jsonb;

-- Мигрировать существующие данные из image_url
UPDATE public.campaigns 
SET media_urls = jsonb_build_array(image_url) 
WHERE image_url IS NOT NULL AND image_url != '';

-- Опционально: удалить старую колонку позже
-- ALTER TABLE public.campaigns DROP COLUMN image_url;
```

---

### 2. CreateCampaignForm.tsx — множественная загрузка

**Изменения в state:**
```tsx
// Было
const [mediaFile, setMediaFile] = useState<File | null>(null);

// Станет
const [mediaFiles, setMediaFiles] = useState<File[]>([]);
const MAX_MEDIA_FILES = 10;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 МБ
```

**Обработчик выбора файлов:**
```tsx
const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files || []);
  
  // Проверка количества
  const remainingSlots = MAX_MEDIA_FILES - mediaFiles.length;
  const filesToAdd = files.slice(0, remainingSlots);
  
  // Проверка размера каждого файла
  const validFiles = filesToAdd.filter(file => {
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "Файл слишком большой",
        description: `${file.name} превышает лимит 50 МБ`,
        variant: "destructive",
      });
      return false;
    }
    return true;
  });
  
  setMediaFiles(prev => [...prev, ...validFiles]);
};
```

**Удаление файла по индексу:**
```tsx
const removeMedia = (index: number) => {
  setMediaFiles(prev => prev.filter((_, i) => i !== index));
};
```

**UI для Step 2 — сетка превью:**
```tsx
{step === 2 && (
  <div className="space-y-6">
    <div className="text-center space-y-2">
      <h2 className="text-xl font-semibold">Медиа</h2>
      <p className="text-muted-foreground text-sm">
        Добавьте до 10 фото или видео
      </p>
    </div>

    <input
      ref={fileInputRef}
      type="file"
      accept="image/*,video/*"
      multiple
      onChange={handleMediaSelect}
      className="hidden"
    />

    {/* Сетка превью */}
    <div className="grid grid-cols-3 gap-2">
      {mediaFiles.map((file, index) => (
        <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-secondary">
          {file.type.startsWith('video/') ? (
            <div className="w-full h-full flex items-center justify-center">
              <FileVideo className="w-8 h-8 text-primary" />
            </div>
          ) : (
            <img
              src={URL.createObjectURL(file)}
              alt={`Media ${index + 1}`}
              className="w-full h-full object-cover"
            />
          )}
          {/* Кнопка удаления */}
          <button
            onClick={() => removeMedia(index)}
            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          {/* Размер файла */}
          <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-xs text-white">
            {(file.size / (1024 * 1024)).toFixed(1)} МБ
          </div>
        </div>
      ))}
      
      {/* Кнопка добавления (если меньше 10 файлов) */}
      {mediaFiles.length < MAX_MEDIA_FILES && (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="aspect-square rounded-xl border-2 border-dashed border-secondary flex flex-col items-center justify-center gap-1 hover:border-primary/50"
        >
          <Plus className="w-6 h-6 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {mediaFiles.length}/{MAX_MEDIA_FILES}
          </span>
        </button>
      )}
    </div>

    {/* Пустое состояние */}
    {mediaFiles.length === 0 && (
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full h-32 rounded-xl border-2 border-dashed border-secondary flex flex-col items-center justify-center gap-2"
      >
        <ImagePlus className="w-8 h-8 text-primary" />
        <span className="text-sm text-muted-foreground">Добавить медиа</span>
      </button>
    )}
  </div>
)}
```

**Загрузка всех файлов в Storage:**
```tsx
const handleSubmit = async () => {
  setIsSubmitting(true);
  try {
    const mediaUrls: string[] = [];

    // Загружаем все файлы
    for (const file of mediaFiles) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("campaign-images")
        .upload(fileName, file);

      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage
          .from("campaign-images")
          .getPublicUrl(fileName);
        mediaUrls.push(publicUrl);
      }
    }

    // Отправляем массив URL в edge function
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-campaign`,
      {
        method: "POST",
        headers: { ... },
        body: JSON.stringify({
          user_id: user.id,
          name: campaignData.name,
          text: campaignData.text,
          button_text: campaignData.button_text || null,
          button_url: campaignData.button_url || null,
          media_urls: mediaUrls, // Массив вместо одного URL
        }),
      }
    );
    // ...
  }
};
```

---

### 3. Edge Function — обновить интерфейс

```typescript
interface CreateCampaignRequest {
  user_id: string;
  name: string;
  text: string;
  button_text?: string;
  button_url?: string;
  media_urls?: string[]; // Массив URL
}

// При вставке
const { data: campaign, error } = await supabase
  .from("campaigns")
  .insert({
    owner_id: user_id,
    name,
    text,
    button_text: button_text || null,
    button_url: button_url || null,
    media_urls: media_urls || [], // JSONB массив
    is_active: true,
  })
  .select()
  .single();
```

---

### 4. CampaignSelector и OrderDrawer — отображение

**OrderDrawer.tsx:**
```tsx
const campaigns = userCampaigns.map(c => ({
  id: c.id,
  name: c.name,
  // Берём первое изображение из массива
  imageUrl: (c.media_urls as string[])?.[0] || c.image_url || '/placeholder.svg',
  text: c.text,
  buttonText: c.button_text || '',
  buttonUrl: c.button_url || '',
}));
```

---

### Визуальная схема UI (Step 2)

```text
┌─────────────────────────────────────────┐
│               Медиа                     │
│    Добавьте до 10 фото или видео        │
├─────────────────────────────────────────┤
│  ┌───────┐  ┌───────┐  ┌───────┐        │
│  │ IMG 1 │  │ IMG 2 │  │ VID 3 │        │
│  │  ✕    │  │  ✕    │  │  ✕    │        │
│  │ 2.1МБ │  │ 1.5МБ │  │ 8.3МБ │        │
│  └───────┘  └───────┘  └───────┘        │
│  ┌───────┐                              │
│  │   +   │  ← Кнопка добавления         │
│  │  3/10 │    (счётчик файлов)          │
│  └───────┘                              │
├─────────────────────────────────────────┤
│  [← Назад]              [Продолжить →]  │
└─────────────────────────────────────────┘
```

---

### Результат

- Пользователь может загрузить от 0 до 10 медиафайлов
- Каждый файл проверяется на лимит 50 МБ (ограничение Telegram)
- Превью отображаются в сетке 3 колонки
- Видео показываются с иконкой (без полного превью для экономии памяти)
- Все файлы загружаются параллельно при создании кампании
- В БД хранится массив URL в JSONB
- При отображении кампании используется первое изображение как превью
