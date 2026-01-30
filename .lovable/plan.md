

## Переход от диалога к полноценной странице настроек канала

Создадим отдельную страницу `/channel/:id/settings`, которая будет выглядеть идентично странице канала с Telegram BackButton.

---

## Архитектура изменений

| Компонент | Сейчас | После |
|-----------|--------|-------|
| Настройки | `ChannelSettingsDialog.tsx` (диалог) | `ChannelSettings.tsx` (страница) |
| Навигация | `onClose()` callback | `navigate(-1)` + Telegram BackButton |
| Маршрут | Нет | `/channel/:id/settings` |
| Вызов | `setSettingsChannel(channel)` | `navigate(`/channel/${id}/settings`)` |

---

## Новые/изменённые файлы

### 1. Новая страница: `src/pages/ChannelSettings.tsx`

Полноэкранная страница с той же структурой что и `Channel.tsx`:

```text
┌────────────────────────────────────────┐
│ [Telegram BackButton ←]               │
├────────────────────────────────────────┤
│ ┌──────────────────────────────────┐   │
│ │      [Фон аватара канала]        │   │
│ │      ┌─────┐                     │   │
│ │      │ 🖼️ │  ← Аватар h-40      │   │
│ │      └─────┘                     │   │
│ │      Название канала ✓           │   │
│ │      @username                   │   │
│ └──────────────────────────────────┘   │
│                                        │
│ ┌─────────┐ ┌─────────┐                │
│ │  ❤️ 42   │ │  ✅ 15   │              │
│ │Избранное│ │ Сделок  │                │
│ └─────────┘ └─────────┘                │
│                                        │
│ ┌──────────────────────────────────┐   │
│ │ 💰 Цены                           │   │
│ │ ...                              │   │
│ └──────────────────────────────────┘   │
│                                        │
│ ┌──────────────────────────────────┐   │
│ │ 📝 Типы кампаний                  │   │
│ │ ...                              │   │
│ └──────────────────────────────────┘   │
│                                        │
│ ┌──────────────────────────────────┐   │
│ │ ⏰ Минимальное время              │   │
│ │ ...                              │   │
│ └──────────────────────────────────┘   │
│                                        │
│ ┌──────────────────────────────────┐   │
│ │ 🗑️ Автоудаление       [Switch]   │   │
│ │ ...                              │   │
│ └──────────────────────────────────┘   │
│                                        │
├────────────────────────────────────────┤
│ ┌──────────────────────────────────┐   │
│ │       Сохранить изменения        │   │ ← Fixed bottom
│ └──────────────────────────────────┘   │
└────────────────────────────────────────┘
```

**Ключевые элементы (как в Channel.tsx):**

```typescript
// Telegram BackButton integration
const handleBack = useCallback(() => {
  navigate(-1);
}, [navigate]);

useEffect(() => {
  if (isTelegramMiniApp()) {
    const webapp = getTelegramWebApp();
    if (webapp?.BackButton) {
      webapp.BackButton.onClick(handleBack);
      webapp.BackButton.show();
      
      return () => {
        webapp.BackButton.offClick(handleBack);
        webapp.BackButton.hide();
      };
    }
  }
}, [handleBack]);
```

**Hero секция (h-40 как в Channel.tsx):**

```tsx
<div className="relative">
  <div className="h-40 overflow-hidden">
    <img src={channel.avatar_url} className="w-full h-full object-cover" />
    <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-background" />
  </div>
  
  <div className="relative -mt-12 flex flex-col items-center px-4">
    <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
      ...
    </Avatar>
    <h1 className="text-xl font-bold">{channel.title}</h1>
    <p className="text-muted-foreground">@{channel.username}</p>
  </div>
</div>
```

**Skeleton loader (как в Channel.tsx):**

```tsx
if (isLoading) {
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="relative h-48 bg-gradient-to-b from-primary/20 to-background">
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
          <Skeleton className="w-24 h-24 rounded-full" />
        </div>
      </div>
      <div className="mt-16 px-4 space-y-4">
        <Skeleton className="h-6 w-48 mx-auto" />
        <Skeleton className="h-4 w-32 mx-auto" />
        <div className="grid grid-cols-2 gap-3 mt-6">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
```

---

### 2. Обновление `src/App.tsx`

Добавить новый маршрут:

```tsx
import ChannelSettings from "./pages/ChannelSettings";

<Route path="/channel/:id/settings" element={<ChannelSettings />} />
```

---

### 3. Обновление `src/components/create/MyChannelsList.tsx`

Заменить открытие диалога на навигацию:

```tsx
import { useNavigate } from 'react-router-dom';

// Убрать:
// const [settingsChannel, setSettingsChannel] = useState<UserChannel | null>(null);
// import { ChannelSettingsDialog } from "./ChannelSettingsDialog";

// Добавить:
const navigate = useNavigate();

// Заменить onClick:
<button
  onClick={() => navigate(`/channel/${channel.id}/settings`)}
  className="p-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
  title="Настройки канала"
>
  <Settings className="w-4 h-4 text-muted-foreground" />
</button>

// Убрать ChannelSettingsDialog из render
```

---

### 4. Удаление `src/components/create/ChannelSettingsDialog.tsx`

Файл больше не нужен — вся логика переносится в новую страницу.

---

## Технические детали страницы ChannelSettings

**Структура файла:**

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, CheckCircle, Clock, Trash2, Loader2, BadgeCheck, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getTelegramWebApp, isTelegramMiniApp } from '@/lib/telegram';
import { useChannelStats, useUpdateChannelSettings, ChannelSettings } from '@/hooks/useChannelSettings';
import { useUserChannels } from '@/hooks/useUserChannels';
import { cn } from '@/lib/utils';

const ChannelSettingsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Загрузка данных канала и статистики
  const { data: channels } = useUserChannels();
  const channel = channels?.find(c => c.id === id);
  const { data, isLoading } = useChannelStats(id || null);
  const updateSettings = useUpdateChannelSettings();
  
  // Состояние настроек
  const [localSettings, setLocalSettings] = useState<Partial<ChannelSettings>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Telegram BackButton
  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  useEffect(() => {
    if (isTelegramMiniApp()) {
      const webapp = getTelegramWebApp();
      if (webapp?.BackButton) {
        webapp.BackButton.onClick(handleBack);
        webapp.BackButton.show();
        return () => {
          webapp.BackButton.offClick(handleBack);
          webapp.BackButton.hide();
        };
      }
    }
  }, [handleBack]);

  // Синхронизация настроек
  useEffect(() => {
    if (data?.settings) {
      setLocalSettings({ ... });
      setHasChanges(false);
    }
  }, [data?.settings]);

  // Handlers...
  
  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Hero Section - h-40 как на странице канала */}
      {/* Statistics Grid */}
      {/* Settings Sections */}
      {/* Fixed Save Button */}
    </div>
  );
};

export default ChannelSettingsPage;
```

---

## Визуальное соответствие странице Channel.tsx

| Элемент | Channel.tsx | ChannelSettings (новая) |
|---------|-------------|-------------------------|
| Hero высота | `h-40` | `h-40` |
| Аватар размер | `h-24 w-24` | `h-24 w-24` |
| Аватар позиция | `-mt-12` | `-mt-12` |
| Заголовок | `text-xl font-bold` | `text-xl font-bold` |
| Секции отступ | `px-4 mt-6` | `px-4 mt-6` |
| Карточки стиль | `bg-secondary/50 rounded-2xl` | `bg-secondary/50 rounded-2xl` |
| Кнопка внизу | `fixed bottom-0` | `fixed bottom-0` |
| Анимации | `motion.div` с delay | `motion.div` с delay |
| Telegram Back | `webapp.BackButton` | `webapp.BackButton` |

---

## Результат

- Полноэкранная страница настроек
- Нативная кнопка "Назад" в Telegram
- Идентичный дизайн со страницей канала
- Без кнопки закрытия (X)
- Плавные анимации появления секций

