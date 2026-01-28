
# Удаление скелетона у баннеров

## Обзор

Полностью убираем логику скелетона из компонента карусели баннеров. Карусель будет отображаться сразу без состояния загрузки.

## Изменения

**Файл:** `src/components/PromoBannerCarousel.tsx`

Удаляем:
- Импорт `Skeleton`
- Состояния `loadedImages`, `allImagesLoaded`, `aspectRatio`
- Функцию `handleImageLoad`
- Условный рендеринг скелетона
- Скрытые изображения для предзагрузки

Остаётся только базовая карусель с автопрокруткой.

## Результат

```tsx
import { useEffect, useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import banner1 from "@/assets/banners/banner1.png";
import banner2 from "@/assets/banners/banner2.png";

const banners = [
  { id: 1, src: banner1, alt: "Промо баннер 1" },
  { id: 2, src: banner2, alt: "Промо баннер 2" },
];

export const PromoBannerCarousel = () => {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  // Автопрокрутка каждые 10 секунд
  useEffect(() => {
    if (!api) return;
    const interval = setInterval(() => {
      if (api.canScrollNext()) {
        api.scrollNext();
      } else {
        api.scrollTo(0);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [api]);

  return (
    <Carousel
      setApi={setApi}
      opts={{ align: "center", loop: true }}
      className="w-full"
    >
      <CarouselContent className="-ml-0">
        {banners.map((banner) => (
          <CarouselItem key={banner.id} className="pl-0">
            <div className="flex justify-center">
              <img
                src={banner.src}
                alt={banner.alt}
                className="w-full h-auto rounded-lg shadow-md"
              />
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
};
```

## Файлы для изменения

| Файл | Действие |
|------|----------|
| `src/components/PromoBannerCarousel.tsx` | Удалить всю логику скелетона |
