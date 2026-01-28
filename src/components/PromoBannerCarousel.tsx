import { useEffect, useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";
import banner1 from "@/assets/banners/banner1.png";
import banner2 from "@/assets/banners/banner2.png";

const banners = [
  { id: 1, src: banner1, alt: "Промо баннер 1" },
  { id: 2, src: banner2, alt: "Промо баннер 2" },
];

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

  // Показываем скелетон если изображения ещё не загружены
  if (!allImagesLoaded) {
    return (
      <div className="w-full">
        <Skeleton className="w-full aspect-[16/7] rounded-lg" />
        {/* Скрытые изображения для предзагрузки */}
        <div className="hidden">
          {banners.map((banner) => (
            <img
              key={banner.id}
              src={banner.src}
              alt=""
              onLoad={() => handleImageLoad(banner.id)}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <Carousel
      setApi={setApi}
      opts={{
        align: "center",
        loop: true,
      }}
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
