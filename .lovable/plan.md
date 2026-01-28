
# Центрирование изображения в видимой области карточки

## Проблема

Сейчас изображение центрируется относительно **всей карточки** (100% ширины), но видна только **правая половина** (50% справа через clipPath). Из-за этого центр изображения попадает на границу видимой области, а не в её середину.

## Решение

Нужно сместить контейнер изображения так, чтобы его центр совпадал с центром видимой области (т.е. с 75% ширины карточки).

Вместо того чтобы располагать изображение на всю ширину карточки, мы разместим его только в правой половине — там, где оно реально видно.

## Техническое изменение

**Файл:** `src/components/ChannelCard.tsx`

**Текущий код (строки 100-111):**
```tsx
{/* Background Image - Right Side */}
<div 
  className="absolute inset-0"
  style={{ clipPath: 'polygon(50% 0, 100% 0, 100% 100%, 50% 100%)' }}
>
  <img
    src={avatar}
    alt={name}
    className="w-full h-full object-contain object-center"
  />
  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/30 to-black/70" />
</div>
```

**Новый код:**
```tsx
{/* Background Image - Right Side */}
<div 
  className="absolute top-0 bottom-0 right-0 w-1/2"
>
  <img
    src={avatar}
    alt={name}
    className="w-full h-full object-contain object-center"
  />
  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/30 to-black/70" />
</div>
```

## Что меняется

1. Убираем `clipPath` — больше не нужен, т.к. контейнер занимает только правую половину
2. Меняем `inset-0` на `top-0 bottom-0 right-0 w-1/2` — контейнер занимает только правые 50%
3. `object-center` теперь центрирует изображение относительно видимого контейнера (правой половины)

## Результат

Изображение канала будет центрироваться именно в видимой области (правой половине карточки), а не в центре всей карточки.
