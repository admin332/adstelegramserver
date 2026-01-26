

## План: Исправить логику определения видимости клавиатуры

### Проблема

Текущая реализация сравнивает `window.innerHeight - viewport.height`, что может давать нестабильные результаты при прокрутке viewport. Меню появляется над клавиатурой вместо того, чтобы оставаться скрытым.

### Решение

Использовать подход с **сохранением начальной высоты** viewport при монтировании компонента:

```
initialHeight (при загрузке) - currentHeight (при resize) > 150px → клавиатура открыта
```

### Изменения в `src/hooks/useKeyboardVisible.ts`

Полностью переписать хук:

```typescript
import { useState, useEffect } from 'react';

export const useKeyboardVisible = () => {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    if (!window.visualViewport) return;

    const viewport = window.visualViewport;
    const initialHeight = viewport.height; // Сохраняем начальную высоту
    const threshold = 150; // Клавиатура обычно > 150px

    const handleResize = () => {
      const heightDiff = initialHeight - viewport.height;
      setIsKeyboardVisible(heightDiff > threshold);
    };

    viewport.addEventListener('resize', handleResize);
    return () => viewport.removeEventListener('resize', handleResize);
  }, []);

  return isKeyboardVisible;
};
```

### Почему это работает лучше

| Текущий подход | Новый подход |
|----------------|--------------|
| `window.innerHeight - viewport.height` | `initialHeight - viewport.height` |
| `innerHeight` может меняться | `initialHeight` фиксирован при загрузке |
| Нестабильно при прокрутке | Стабильное сравнение |

### Логика работы

```text
1. При загрузке страницы:
   initialHeight = 800px (полный экран)

2. Пользователь нажимает на input:
   → Клавиатура открывается
   → viewport.height = 500px
   → heightDiff = 800 - 500 = 300px
   → 300 > 150 → isKeyboardVisible = true
   → BottomNav возвращает null

3. Пользователь закрывает клавиатуру:
   → viewport.height = 800px
   → heightDiff = 800 - 800 = 0px
   → 0 > 150 → false
   → isKeyboardVisible = false
   → BottomNav отображается
```

### Файл для изменения

| Файл | Изменение |
|------|-----------|
| `src/hooks/useKeyboardVisible.ts` | Переписать с использованием `initialHeight` |

