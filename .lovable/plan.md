

# Исправление размеров скелетона для баннеров

## Проблема

Скелетон с фиксированным соотношением сторон `aspect-[16/7]` не соответствует реальным размерам баннеров, что приводит к скачку контента при загрузке.

## Решение

Использовать динамический расчёт размеров: сначала загружаем первое изображение в скрытом режиме, определяем его реальные размеры, и используем их для скелетона.

## Изменения

**Файл:** `src/components/PromoBannerCarousel.tsx`

```tsx
export const PromoBannerCarousel = () => {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [allImagesLoaded, setAllImagesLoaded] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  // Обработчик загрузки изображения
  const handleImageLoad = (id: number, event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    
    // Сохраняем aspect ratio первого загруженного изображения
    if (aspectRatio === null && img.naturalWidth && img.naturalHeight) {
      setAspectRatio(img.naturalWidth / img.naturalHeight);
    }
    
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
        <Skeleton 
          className="w-full rounded-lg" 
          style={{ aspectRatio: aspectRatio || 16/7 }}
        />
        {/* Скрытые изображения для предзагрузки */}
        <div className="hidden">
          {banners.map((banner) => (
            <img
              key={banner.id}
              src={banner.src}
              alt=""
              onLoad={(e) => handleImageLoad(banner.id, e)}
            />
          ))}
        </div>
      </div>
    );
  }

  // ... остальной код без изменений
};
```

## Как это работает

1. При первой загрузке показываем скелетон с дефолтным ratio (16/7)
2. Как только первый баннер загружается, получаем его реальные размеры через `naturalWidth` и `naturalHeight`
3. Обновляем aspect ratio скелетона на реальный
4. Когда все изображения загружены — показываем карусель

## Результат

Скелетон будет точно соответствовать размерам реальных баннеров, предотвращая скачки контента при загрузке.

