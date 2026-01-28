

# Добавление анимированного TGS стикера над первым каналом

## Обзор

Добавляем анимированный Telegram стикер (.tgs) над первой карточкой канала на главной странице. Стикер будет отображаться поверх контента (overlay) без отступа сверху от первой карточки.

## Техническое решение

TGS файлы — это gzip-сжатые Lottie JSON анимации. Для их рендеринга нужно:
1. Распаковать gzip с помощью библиотеки `pako`
2. Отрендерить Lottie анимацию с помощью `lottie-react`
3. Позиционировать стикер абсолютно поверх контента

## Файлы для изменения

| Файл | Действие |
|------|----------|
| `package.json` | Добавить `pako` и `lottie-react` |
| `src/assets/stickers/` | Создать папку и скопировать стикер |
| `src/components/TgsSticker.tsx` | Новый компонент для рендеринга TGS |
| `src/pages/Index.tsx` | Добавить стикер над первым каналом |

## Детали реализации

### 1. Установка зависимостей

```json
{
  "dependencies": {
    "pako": "^2.1.0",
    "lottie-react": "^2.4.0"
  }
}
```

### 2. Копирование стикера

Копируем загруженный файл в `src/assets/stickers/animated-sticker.tgs`

### 3. Компонент TgsSticker

```tsx
import { useState, useEffect } from 'react';
import Lottie from 'lottie-react';
import pako from 'pako';

interface TgsStickerProps {
  src: string;
  className?: string;
  loop?: boolean;
  autoplay?: boolean;
  style?: React.CSSProperties;
}

export const TgsSticker = ({ 
  src, 
  className, 
  loop = true, 
  autoplay = true,
  style 
}: TgsStickerProps) => {
  const [animationData, setAnimationData] = useState<object | null>(null);

  useEffect(() => {
    const loadTgs = async () => {
      const response = await fetch(src);
      const buffer = await response.arrayBuffer();
      const decompressed = pako.ungzip(new Uint8Array(buffer), { to: 'string' });
      const json = JSON.parse(decompressed);
      setAnimationData(json);
    };
    
    loadTgs();
  }, [src]);

  if (!animationData) return null;

  return (
    <Lottie
      animationData={animationData}
      loop={loop}
      autoPlay={autoplay}
      className={className}
      style={style}
    />
  );
};
```

### 4. Интеграция в Index.tsx

```tsx
// В секции каналов (строки 174-191)
<div className="space-y-3">
  {isLoading ? (
    [1, 2, 3].map((i) => <ChannelCardSkeleton key={i} />)
  ) : filteredChannels.length > 0 ? (
    filteredChannels.map((channel, index) => (
      <div key={channel.id} className="relative">
        {/* Стикер только над первой карточкой */}
        {index === 0 && (
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <TgsSticker 
              src="/stickers/animated-sticker.tgs"
              className="w-24 h-24"
            />
          </div>
        )}
        <ChannelCard 
          {...channel} 
          isLiked={isFavorite(channel.id)}
          onLikeToggle={toggleFavorite}
        />
      </div>
    ))
  ) : (
    <div className="text-center py-8 text-muted-foreground">
      {showFavoritesOnly ? "Нет избранных каналов" : "Каналы не найдены"}
    </div>
  )}
</div>
```

## Позиционирование стикера

- `absolute` — абсолютное позиционирование относительно родителя
- `-top-12` — смещение вверх (выходит за пределы карточки)
- `left-1/2 -translate-x-1/2` — центрирование по горизонтали
- `z-10` — отображение поверх контента
- `pointer-events-none` — клики проходят сквозь стикер

## Результат

Анимированный стикер будет плавно воспроизводиться над первой карточкой канала, не сдвигая другие элементы и отображаясь поверх них.

