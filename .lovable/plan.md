

## Добавление проверки второго администратора (@kjeuz) для аналитики

---

## Обзор

При автоматическом обнаружении канала система должна проверять, добавлен ли также `@kjeuz` как администратор. Если добавлен только `@adsingo_bot`, показать предупреждение о необходимости добавить второго админа для получения детальной статистики.

---

## Изменения

### 1. Edge Function: `supabase/functions/detect-bot-channels/index.ts`

**Добавить проверку @kjeuz (ID: нужно получить) в каждом канале:**

```typescript
// Добавить константу с ID @kjeuz
const ANALYTICS_BOT_USERNAME = "kjeuz";

// В интерфейс DetectedChannel добавить новое поле:
interface DetectedChannel {
  // ... существующие поля
  has_analytics_admin: boolean;  // Добавлен ли @kjeuz
}

// В цикле обработки каналов, после проверки пользователя:
// Проверить, добавлен ли @kjeuz как админ
let hasAnalyticsAdmin = false;
try {
  const kjeuzResponse = await fetch(
    `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${chatId}&user_id=@${ANALYTICS_BOT_USERNAME}`
  );
  const kjeuzData = await kjeuzResponse.json();
  
  if (kjeuzData.ok) {
    const kjeuzStatus = kjeuzData.result.status;
    hasAnalyticsAdmin = kjeuzStatus === 'administrator' || kjeuzStatus === 'creator';
  }
} catch {
  console.log(`Could not check @kjeuz status in channel ${chatId}`);
}

// Добавить в объект канала:
detectedChannels.push({
  // ... существующие поля
  has_analytics_admin: hasAnalyticsAdmin,
});
```

---

### 2. Frontend: `src/components/create/AddChannelWizard.tsx`

**Обновить интерфейс DetectedChannel:**

```typescript
interface DetectedChannel {
  // ... существующие поля
  has_analytics_admin: boolean;
}
```

**Добавить предупреждение после карточки канала (после строки ~486):**

```tsx
{/* Warning if @kjeuz not added */}
{selectedChannel && !selectedChannel.has_analytics_admin && (
  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
    <div className="flex items-start gap-2">
      <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm text-yellow-500 font-medium">
          Добавьте @kjeuz для аналитики
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Для получения детальной статистики канала (просмотры по часам, рост аудитории) 
          добавьте{" "}
          <a 
            href="https://t.me/kjeuz" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            @kjeuz
          </a>
          {" "}как администратора
        </p>
      </div>
    </div>
  </div>
)}
```

---

## Логика отображения

| Состояние | UI |
|-----------|-----|
| Бот добавлен + @kjeuz добавлен | Зелёная галочка, полная статистика доступна |
| Бот добавлен + @kjeuz НЕ добавлен | Жёлтое предупреждение с ссылкой на @kjeuz |
| Бот НЕ добавлен | Канал не появляется в списке |

---

## Визуальный результат

```
┌────────────────────────────────────────┐
│  ✓ Канал найден!                       │
├────────────────────────────────────────┤
│  [Avatar] Название канала              │
│           @username                    │
│           👥 12,500   👁 3,200 / пост   │
├────────────────────────────────────────┤
│  ⚠️ Добавьте @kjeuz для аналитики      │ ← НОВОЕ
│     Для получения детальной            │
│     статистики канала...               │
├────────────────────────────────────────┤
│  💚 Рекомендуемая цена: 5.2 TON        │
│     На основе 3,200 просмотров/пост    │
└────────────────────────────────────────┘
```

---

## Файлы для изменения

| Файл | Изменения |
|------|-----------|
| `supabase/functions/detect-bot-channels/index.ts` | Добавить проверку @kjeuz, новое поле `has_analytics_admin` |
| `src/components/create/AddChannelWizard.tsx` | Добавить интерфейс и предупреждение в UI |

