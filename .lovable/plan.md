

# Добавление скелетона для баннеров

## Обзор

Добавляем состояние загрузки для карусели промо-баннеров, чтобы пользователь видел плавный скелетон вместо пустого места пока изображения загружаются.

## Текущий вид (при загрузке)

```
┌─────────────────────────────────────────────┐
│                                             │
│              (пустое место)                 │
│                                             │
└─────────────────────────────────────────────┘
```

## Новый вид (при загрузке)

```
┌─────────────────────────────────────────────┐
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ │
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ │
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ │
└─────────────────────────────────────────────┘
```

## Изменения

### 1. Обновление компонента PromoBannerCarousel

**Файл:** `src/components/PromoBannerCarousel.tsx`

Добавляем состояние загрузки изображений:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export const PromoBannerCarousel = () => {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [allImagesLoaded, setAllImagesLoaded] = useState(false);

  // Обработчик загрузки изображения
  const handleImageLoad = (id: number) => {
    setLoadedImages(prev => {
      const newSet = new Set(prev);
      newSet.add(id);
      if (newSet.size === banners.length) {
        setAllImagesLoaded(true);
      }
      return newSet;
    });
  };

  // Показываем скелетон если изображения ещё не загружены
  if (!allImagesLoaded) {
    return (
      <div className="w-full">
        <Skeleton className="w-full aspect-[16/7] rounded-lg" />
      </div>
    );
  }

  return (
    <Carousel ...>
      {/* Существующий код карусели */}
      <img
        src={banner.src}
        alt={banner.alt}
        onLoad={() => handleImageLoad(banner.id)}
        className="w-full h-auto rounded-lg shadow-md"
      />
    </Carousel>
  );
};
```

### 2. Интеграция с главной страницей

**Файл:** `src/pages/Index.tsx`

Компонент `PromoBannerCarousel` уже используется на странице и будет автоматически показывать скелетон во время загрузки.

## Визуальные характеристики скелетона

| Параметр | Значение |
|----------|----------|
| Соотношение сторон | 16:7 (как у баннеров) |
| Скругление | rounded-lg |
| Анимация | animate-pulse (стандартная) |

## Файлы для изменения

| Файл | Действие |
|------|----------|
| `src/components/PromoBannerCarousel.tsx` | Добавить состояние загрузки и скелетон |

