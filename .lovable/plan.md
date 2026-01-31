

## Автоматическое обнаружение каналов и расчёт рекомендуемой цены

---

## Обзор

Улучшение процесса добавления канала:
1. После нажатия «Готово, далее» система автоматически ищет каналы, где пользователь И бот являются администраторами
2. Показывает найденный канал со статистикой
3. Рассчитывает и показывает рекомендуемую стоимость рекламы на основе статистики

---

## Архитектура

```text
┌─────────────────────────────────────────────────────────────────┐
│                    AddChannelWizard.tsx                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Шаг 1: Инструкция → Добавить ботов                            │
│         ↓                                                       │
│  Шаг 2: [НОВЫЙ] Автопоиск → Загрузка → Показ канала + цены     │
│         ↓                                                       │
│  Шаг 3: Подтверждение категории и цены → Верификация           │
│         ↓                                                       │
│  Шаг 4: Успех                                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Edge Function: detect-bot-channels
- Вызывает getUpdates → ищет my_chat_member events
- Для каждого канала: getChatMember(userId) → проверяет админа
- Собирает статистику: подписчики, avg_views, engagement
- Рассчитывает рекомендуемую цену по формуле
```

---

## Формула расчёта рекомендуемой цены

```text
Базовая ставка: $1.50 за 1000 views (CPM)
TON-эквивалент: CPM / tonPrice

Рекомендуемая цена = (avgViews / 1000) × CPM × множитель_категории

Множители по категориям:
- crypto, tech, business: 1.5×
- lifestyle, education: 1.2×
- entertainment, humor: 0.8×
- остальные: 1.0×

Минимальная цена: 1 TON
```

---

## Изменения

### 1. Новая Edge Function: `supabase/functions/detect-bot-channels/index.ts`

```typescript
// Основная логика:

1. Валидация initData пользователя

2. Получить telegram_id пользователя

3. Вызвать Bot API getUpdates с offset=-100
   → Фильтр: my_chat_member events где bot становится admin

4. Для каждого найденного канала:
   a. getChatMember(chatId, userId) → проверить что user тоже админ
   b. Проверить что канала ещё нет в БД
   c. Получить статистику: subscribers, scrape views

5. Рассчитать рекомендуемую цену для каждого канала

6. Вернуть массив каналов с:
   - title, username, avatar, subscribers
   - avg_views, engagement
   - recommended_price_24 (TON)
   - recommended_price_48 (TON)
```

### 2. Обновление `src/components/create/AddChannelWizard.tsx`

**Шаг 2 → Автоматический поиск:**

```tsx
// Новые состояния:
const [isSearching, setIsSearching] = useState(false);
const [detectedChannels, setDetectedChannels] = useState<DetectedChannel[]>([]);
const [selectedChannel, setSelectedChannel] = useState<DetectedChannel | null>(null);

// При переходе на шаг 2:
useEffect(() => {
  if (step === 2) {
    detectChannels();
  }
}, [step]);

async function detectChannels() {
  setIsSearching(true);
  const response = await fetch('/functions/v1/detect-bot-channels', {
    body: JSON.stringify({ initData })
  });
  const data = await response.json();
  
  if (data.channels?.length > 0) {
    setDetectedChannels(data.channels);
    setSelectedChannel(data.channels[0]); // Авто-выбор первого
  }
  setIsSearching(false);
}
```

**UI Шага 2:**

```tsx
{isSearching ? (
  <div className="text-center py-8">
    <Loader2 className="animate-spin mx-auto" />
    <p>Ищем ваши каналы...</p>
  </div>
) : detectedChannels.length > 0 ? (
  <div className="space-y-4">
    {/* Карточка найденного канала */}
    <ChannelPreviewCard 
      channel={selectedChannel}
      recommendedPrice={selectedChannel.recommended_price_24}
    />
    
    {/* Ручной ввод цены с подсказкой */}
    <div>
      <Label>Цена 1/24 (рекомендуемая: {recommendedPrice} TON)</Label>
      <Input 
        value={channelData.price_1_24} 
        placeholder={recommendedPrice.toString()}
      />
    </div>
  </div>
) : (
  // Fallback: ручной ввод username (текущее поведение)
  <Input placeholder="@channel или ссылка" />
)}
```

### 3. Компонент подсказки цены

```tsx
// Внутри AddChannelWizard.tsx

const RecommendedPriceBadge = ({ price, avgViews }) => (
  <div className="bg-green-500/10 text-green-500 rounded-lg p-3">
    <div className="flex items-center gap-2">
      <Sparkles className="w-4 h-4" />
      <span>Рекомендуемая цена: <b>{price} TON</b></span>
    </div>
    <p className="text-xs text-muted-foreground mt-1">
      На основе {avgViews.toLocaleString()} просмотров/пост
    </p>
  </div>
);
```

---

## Технические детали

### Ограничения Telegram Bot API

- `getUpdates` хранит обновления ~24 часа
- Нужно периодически вызывать для очистки буфера
- Альтернатива: сохранять `my_chat_member` события из webhook в БД

### Улучшенный подход (опционально)

Добавить обработку `my_chat_member` в telegram-webhook:
```typescript
// В telegram-webhook/index.ts
if (update.my_chat_member) {
  const { chat, new_chat_member, from } = update.my_chat_member;
  
  if (chat.type === 'channel' && new_chat_member.status === 'administrator') {
    // Сохранить в таблицу pending_channel_verifications
    await supabase.from('pending_channel_verifications').upsert({
      telegram_chat_id: chat.id,
      added_by_telegram_id: from.id,
      detected_at: new Date().toISOString()
    });
  }
}
```

---

## Файлы для изменения/создания

| Файл | Действие |
|------|----------|
| `supabase/functions/detect-bot-channels/index.ts` | Создать |
| `src/components/create/AddChannelWizard.tsx` | Обновить шаг 2 |
| `supabase/functions/telegram-webhook/index.ts` | Добавить обработку my_chat_member (опционально) |

---

## Порядок реализации

1. **Создать edge-функцию** `detect-bot-channels`
   - Поиск через getUpdates
   - Проверка прав пользователя
   - Сбор статистики и расчёт цены

2. **Обновить AddChannelWizard**
   - Автоматический вызов при переходе на шаг 2
   - UI для отображения найденных каналов
   - Показ рекомендуемой цены

3. **Тестирование**
   - Добавить бота в тестовый канал
   - Проверить автоопределение
   - Проверить расчёт цены

