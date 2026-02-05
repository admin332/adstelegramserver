
# План: Исправление отображения аватарок каналов

## Проблема
Когда в базе есть `avatar_url`, но ссылка недоступна (истёкший Telegram URL), изображение не загружается и показывается пустое место. Fallback на ui-avatars работает только если `avatar_url === null`.

## Решение
Добавить обработку ошибок загрузки изображений (`onError`) во всех местах где отображаются аватарки каналов.

---

## Затрагиваемые компоненты

### 1. ChannelCard.tsx (каталог каналов)
**Проблема**: Строки 143-150 — `<img>` без onError handler

**Исправление**:
```tsx
const [imgError, setImgError] = useState(false);

// Fallback avatar
const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=200`;
const displayAvatar = imgError ? fallbackAvatar : avatar;

<img
  src={displayAvatar}
  alt={name}
  className="w-full h-full object-cover object-center"
  onError={() => setImgError(true)}
/>
```

### 2. ChannelHero.tsx (страница канала)
**Проблема**: AvatarImage без onError fallback

**Исправление**:
```tsx
const [imgError, setImgError] = useState(false);

const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&size=200`;

<Avatar className="h-24 w-24 border-4 border-background shadow-lg">
  {!imgError && avatar ? (
    <AvatarImage 
      src={avatar} 
      alt={name}
      onError={() => setImgError(true)}
    />
  ) : null}
  <AvatarFallback className="text-2xl font-bold">
    {imgError ? (
      <img src={fallbackAvatar} alt={name} className="w-full h-full" />
    ) : (
      name.charAt(0)
    )}
  </AvatarFallback>
</Avatar>
```

### 3. MyChannelsList.tsx (список моих каналов)
**Проблема**: Строки 72-80 — отображение аватарки без onError

**Исправление**: Аналогичная логика с useState и onError

### 4. DealCard.tsx (карточки сделок)
**Проблема**: Строки 379-384 — AvatarImage может не загрузиться

**Исправление**: Добавить onError для переключения на fallback

---

## Файлы для изменения

| Файл | Изменения |
|------|-----------|
| `src/components/ChannelCard.tsx` | Добавить useState для imgError, onError handler |
| `src/components/channel/ChannelHero.tsx` | Добавить useState, onError для AvatarImage |
| `src/components/create/MyChannelsList.tsx` | Добавить onError для img в списке каналов |
| `src/components/DealCard.tsx` | Добавить onError для AvatarImage |

---

## Дополнительно

### Улучшение fallback в useChannels.ts
Текущий fallback работает только при `avatar_url === null`. Можно также проверять пустую строку:

```ts
avatar: dbChannel.avatar_url && dbChannel.avatar_url.trim() !== '' 
  ? dbChannel.avatar_url 
  : `https://ui-avatars.com/api/?name=${encodeURIComponent(dbChannel.title || dbChannel.username)}&background=random`,
```

---

## Результат
- Если изображение не загружается → показывается красивый fallback с первой буквой названия
- Пользователь никогда не видит пустые/сломанные аватарки
- Работает для всех компонентов: каталог, страница канала, мои каналы, сделки
