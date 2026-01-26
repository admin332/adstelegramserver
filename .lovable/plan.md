

## План: Замена иконки TON на текст и интеграция Telegram BackButton

### Что нужно сделать

1. **Заменить иконку TON на белый текст "TON"** во всех местах на странице канала
2. **Удалить кастомную кнопку "Назад"** и внедрить встроенную Telegram BackButton

---

### Изменения в файлах

#### 1. `src/lib/telegram.ts` — Добавить интерфейс BackButton

Добавить в интерфейс `TelegramWebApp`:
```typescript
BackButton: {
  isVisible: boolean;
  show: () => void;
  hide: () => void;
  onClick: (callback: () => void) => void;
  offClick: (callback: () => void) => void;
};
```

Создать хелпер-функции:
```typescript
export function showBackButton(callback: () => void): void { ... }
export function hideBackButton(): void { ... }
```

---

#### 2. `src/components/channel/ChannelHero.tsx` — Удалить кнопку назад

**Что удалить:**
- Импорт `ArrowLeft` из lucide-react (строка 3)
- Импорт `Button` (строка 5)
- Импорт `useNavigate` (строка 4)
- Хук `const navigate = useNavigate()` (строка 23)
- Весь блок `{/* Back Button */}` (строки 37-45)

**Результат**: Hero-компонент станет чисто визуальным, без навигации

---

#### 3. `src/pages/Channel.tsx` — Интегрировать Telegram BackButton

**Добавить:**
```typescript
import { useEffect } from 'react';
import { showBackButton, hideBackButton, isTelegramMiniApp } from '@/lib/telegram';

// Внутри компонента:
useEffect(() => {
  if (isTelegramMiniApp()) {
    showBackButton(() => navigate(-1));
    return () => hideBackButton();
  }
}, [navigate]);
```

**Заменить иконку TON на текст:**

Было:
```tsx
<span className="flex items-center gap-1.5 ml-2 opacity-80">
  <img src={TonIcon} alt="TON" className="w-4 h-4" />
  {channel.tonPrice}
</span>
```

Станет:
```tsx
<span className="text-white/80 ml-2">
  {channel.tonPrice} TON
</span>
```

**Удалить:**
- Импорт `TonIcon` (строка 10)

---

#### 4. `src/components/channel/PostQuantitySelector.tsx` — Заменить иконку TON

**Удалить:**
- Импорт `TonIcon` (строка 5)

**Заменить (строка 103):**

Было:
```tsx
<img src={TonIcon} alt="TON" className="w-5 h-5" />
<span className="text-foreground">{totalPrice}</span>
```

Станет:
```tsx
<span className="text-white">{totalPrice} TON</span>
```

---

### Как работает Telegram BackButton

```
┌────────────────────────────────────────┐
│  ←  AppName                            │  ← Telegram заголовок
├────────────────────────────────────────┤
│                                        │
│     [Hero с фото канала]               │  ← Без кастомной кнопки
│                                        │
│         CryptoNews ✓                   │
│        @cryptonews_official            │
│                                        │
└────────────────────────────────────────┘
```

- **Кнопка "←"** появляется в системном заголовке Telegram
- Работает нативно — выглядит как iOS системный элемент
- Автоматически скрывается при выходе со страницы (cleanup в useEffect)

---

### Итоговый вид цены

**На кнопке заказа:**
```
🛒 Заказать рекламу  50 TON
```

**В селекторе количества:**
```
2 × 50 TON = 100 TON
```

---

### Порядок реализации

1. Обновить `src/lib/telegram.ts` — добавить BackButton API
2. Изменить `src/pages/Channel.tsx` — подключить BackButton + убрать иконку TON
3. Изменить `src/components/channel/ChannelHero.tsx` — удалить кнопку назад
4. Изменить `src/components/channel/PostQuantitySelector.tsx` — убрать иконку TON

