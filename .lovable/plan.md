

## План: Отключение приближения на сайте и улучшение работы скрытия меню

### Текущая ситуация

Скрытие нижнего меню при открытии клавиатуры **уже реализовано**:
- Хук `useKeyboardVisible` отслеживает изменения `window.visualViewport`
- `BottomNav` использует этот хук и возвращает `null` при `isKeyboardVisible === true`

Проблема может быть в:
1. Порог `heightDiff > 150` может быть слишком большим для некоторых устройств
2. Нет отключения zoom на сайте

### Изменения

#### 1. Улучшить хук `useKeyboardVisible` — `src/hooks/useKeyboardVisible.ts`

Уменьшим порог определения клавиатуры и добавим дополнительную логику:

```typescript
import { useState, useEffect } from 'react';

export const useKeyboardVisible = () => {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    
    if (viewport) {
      const handleResize = () => {
        // Уменьшаем порог до 100px для лучшего определения
        const heightDiff = window.innerHeight - viewport.height;
        setIsKeyboardVisible(heightDiff > 100);
      };

      viewport.addEventListener('resize', handleResize);
      viewport.addEventListener('scroll', handleResize);
      
      return () => {
        viewport.removeEventListener('resize', handleResize);
        viewport.removeEventListener('scroll', handleResize);
      };
    }

    // Fallback для браузеров без visualViewport
    const handleFocus = (e: FocusEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        setIsKeyboardVisible(true);
      }
    };

    const handleBlur = () => {
      setTimeout(() => setIsKeyboardVisible(false), 100);
    };

    document.addEventListener('focusin', handleFocus);
    document.addEventListener('focusout', handleBlur);

    return () => {
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('focusout', handleBlur);
    };
  }, []);

  return isKeyboardVisible;
};
```

**Изменения:**
- Порог уменьшен с `150` до `100` пикселей
- Добавлен слушатель события `scroll` для visualViewport
- Добавлен `setTimeout` в handleBlur для плавного скрытия

---

#### 2. Отключить zoom на всём сайте — `index.html`

Обновить meta viewport:

```html
<!-- Строка 5 - было: -->
<meta name="viewport" content="width=device-width, initial-scale=1.0" />

<!-- Станет: -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
```

---

#### 3. Добавить CSS защиту от zoom — `src/index.css`

Добавить правила в секцию `@layer base`:

```css
html {
  touch-action: manipulation;
}

/* Предотвращает auto-zoom на iOS при фокусе на input */
input, textarea, select {
  font-size: 16px !important;
}
```

---

### Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/hooks/useKeyboardVisible.ts` | Улучшить логику определения клавиатуры |
| `index.html` | Добавить `maximum-scale=1.0, user-scalable=no` |
| `src/index.css` | Добавить `touch-action: manipulation` и `font-size: 16px` для inputs |

---

### Результат

- Нижнее меню скрывается при открытии клавиатуры на всех страницах включая `/create`
- Приближение (zoom) отключено на всём сайте
- Нет auto-zoom на iOS при фокусе на текстовые поля

