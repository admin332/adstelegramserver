

## Редизайн окна настроек канала

Переделаю диалог настроек, чтобы он полностью соответствовал стилю страницы канала.

---

## Текущие проблемы

| Элемент | Сейчас | Должно быть |
|---------|--------|-------------|
| Заголовок | DialogHeader стандартный | Hero секция с аватаром канала |
| Секции | Разделены `<Separator>` | Отдельные карточки `bg-secondary/50 rounded-2xl` |
| Анимации | Нет | `motion.div` с задержками как на странице канала |
| Стиль | Тусклый модальный диалог | Яркий, с градиентами и акцентами |
| Layout | Тесный grid | Просторные секции как на Channel.tsx |

---

## Новый дизайн

### Структура

```text
┌────────────────────────────────────────┐
│ ┌──────────────────────────────────┐   │
│ │      [Фон аватара канала]        │   │
│ │      ┌─────┐                     │   │
│ │      │ 🖼️ │  ← Аватар           │   │
│ │      └─────┘                     │   │
│ │      Название канала ✓           │   │
│ │      @username                   │   │
│ └──────────────────────────────────┘   │
│                                        │
│ ┌─────────┐ ┌─────────┐                │
│ │  ❤️ 42   │ │  ✅ 15   │  ← Статистика │
│ │Избранное│ │ Сделок  │                │
│ └─────────┘ └─────────┘                │
│                                        │
│ ┌──────────────────────────────────┐   │
│ │ 💰 Цены                           │   │
│ │ 24 часа    ┌────────┐            │   │
│ │            │ 1.5    │ TON        │   │
│ │ 48 часов   └────────┘            │   │
│ └──────────────────────────────────┘   │
│                                        │
│ ┌──────────────────────────────────┐   │
│ │ 📝 Типы кампаний                  │   │
│ │ ○ Промпт  ○ Готовый  ● Любой     │   │
│ └──────────────────────────────────┘   │
│                                        │
│ ┌──────────────────────────────────┐   │
│ │ ⏰ Минимальное время              │   │
│ │ ━━━━━━━━●━━━━━━━━ +6ч             │   │
│ └──────────────────────────────────┘   │
│                                        │
│ ┌──────────────────────────────────┐   │
│ │ 🗑️ Автоудаление       [Switch]   │   │
│ └──────────────────────────────────┘   │
│                                        │
│ ┌──────────────────────────────────┐   │
│ │       Сохранить изменения        │   │
│ └──────────────────────────────────┘   │
└────────────────────────────────────────┘
```

---

## Технические изменения

### Файл: `src/components/create/ChannelSettingsDialog.tsx`

**1. Hero секция с аватаром канала**

Как в `ChannelHero.tsx`:

```tsx
{/* Hero Section */}
<div className="relative">
  <div className="h-24 overflow-hidden rounded-t-lg">
    <img
      src={channel.avatar_url || '/placeholder.svg'}
      alt={channel.title}
      className="w-full h-full object-cover"
    />
    <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-background" />
  </div>
  
  <div className="relative -mt-8 flex flex-col items-center">
    <Avatar className="h-16 w-16 border-4 border-background shadow-lg">
      <AvatarImage src={channel.avatar_url} />
      <AvatarFallback>{channel.title?.charAt(0)}</AvatarFallback>
    </Avatar>
    
    <div className="flex items-center gap-2 mt-2">
      <h2 className="text-lg font-bold">{channel.title}</h2>
      {channel.verified && <BadgeCheck className="w-4 h-4 text-primary" />}
    </div>
    <p className="text-sm text-muted-foreground">@{channel.username}</p>
  </div>
</div>
```

**2. Статистика как ChannelStats**

Grid 2 колонки с motion анимациями:

```tsx
<div className="grid grid-cols-2 gap-3 px-4 mt-4">
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.1 }}
    className="bg-secondary/50 rounded-2xl p-4 text-center"
  >
    <Heart className="h-5 w-5 mx-auto mb-2 text-red-400" />
    <p className="text-2xl font-bold">{stats.favorites_count}</p>
    <p className="text-xs text-muted-foreground">В избранном</p>
  </motion.div>
  
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.2 }}
    className="bg-secondary/50 rounded-2xl p-4 text-center"
  >
    <CheckCircle className="h-5 w-5 mx-auto mb-2 text-green-400" />
    <p className="text-2xl font-bold">{stats.completed_deals_count}</p>
    <p className="text-xs text-muted-foreground">Сделок</p>
  </motion.div>
</div>
```

**3. Секции настроек как карточки**

Каждая секция — отдельная карточка с анимацией:

```tsx
{/* Prices Section */}
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.3 }}
  className="px-4 mt-4"
>
  <h3 className="text-lg font-semibold text-foreground mb-2">Цены</h3>
  <div className="bg-secondary/50 rounded-2xl p-4 space-y-4">
    {/* Price inputs */}
  </div>
</motion.div>
```

**4. Секция типов кампаний с карточками выбора**

Визуальные карточки вместо RadioGroup:

```tsx
<div className="grid grid-cols-3 gap-2">
  {['prompt', 'ready_post', 'both'].map((type) => (
    <button
      key={type}
      onClick={() => handleSettingChange('accepted_campaign_types', type)}
      className={cn(
        "p-3 rounded-xl text-center transition-all",
        localSettings.accepted_campaign_types === type
          ? "bg-primary text-primary-foreground"
          : "bg-secondary/50 hover:bg-secondary"
      )}
    >
      <span className="text-sm">{typeLabels[type]}</span>
    </button>
  ))}
</div>
```

**5. Slider с визуальными метками**

Как в ChannelAnalytics:

```tsx
<div className="bg-secondary/50 rounded-2xl p-4">
  <Slider ... />
  <div className="flex justify-between mt-3">
    {[0, 6, 12, 24, 48, 72].map((h) => (
      <span 
        key={h}
        className={cn(
          "text-xs",
          localSettings.min_hours_before_post === h 
            ? "text-primary font-bold" 
            : "text-muted-foreground"
        )}
      >
        {h}ч
      </span>
    ))}
  </div>
</div>
```

**6. Автоудаление с описанием**

Карточка с border-dashed как описание на странице канала:

```tsx
<div className="bg-secondary/50 rounded-2xl p-4">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <Trash2 className="h-5 w-5 text-primary" />
      <span className="font-medium">Автоудаление</span>
    </div>
    <Switch ... />
  </div>
  
  {localSettings.auto_delete_posts && (
    <div className="mt-3 p-3 rounded-xl border-2 border-dashed border-amber-500/50 bg-amber-500/10">
      <p className="text-xs text-amber-400">
        Пост будет удалён автоматически после окончания срока размещения
      </p>
    </div>
  )}
</div>
```

**7. Кнопка сохранения**

Fixed внизу как на странице канала:

```tsx
<div className="sticky bottom-0 p-4 bg-gradient-to-t from-background via-background to-transparent">
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.6 }}
  >
    <Button
      onClick={handleSave}
      disabled={!hasChanges || updateSettings.isPending}
      className="w-full h-12 text-base font-semibold rounded-2xl"
    >
      Сохранить изменения
    </Button>
  </motion.div>
</div>
```

---

## Визуальные улучшения

| Элемент | Изменение |
|---------|-----------|
| Анимации | Все секции с `motion.div` и задержками 0.1-0.6с |
| Карточки | `bg-secondary/50 rounded-2xl` вместо разделителей |
| Отступы | Единообразные `px-4 mt-4` |
| Акценты | Primary цвет для активных элементов |
| Предупреждения | Border-dashed стиль как описание |
| Скролл | Плавный overflow с градиентом |

---

## Результат

Окно настроек будет выглядеть как мини-версия страницы канала:
- Hero с аватаром
- Статистика в карточках
- Настройки в секциях
- Анимации появления
- Единый визуальный стиль

