

## План: Переместить уведомления вниз на всех устройствах

### Проблема

Сейчас в `ToastViewport` настроена позиция:
- **Мобильные**: `top-0` (сверху)
- **Десктоп (sm+)**: `sm:bottom-0` (снизу)

### Решение

Изменить CSS классы в `ToastViewport` чтобы уведомления всегда появлялись снизу, учитывая нижнее меню навигации (отступ ~100px).

### Изменения

| Файл | Изменение |
|------|-----------|
| `src/components/ui/toast.tsx` | Обновить классы позиционирования в `ToastViewport` |

### Детали изменений

**Было (строка 17):**
```css
fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 
sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]
```

**Станет:**
```css
fixed bottom-20 z-[100] flex max-h-screen w-full flex-col p-4 
left-0 right-0 md:max-w-[420px] md:left-auto
```

Также нужно обновить анимации входа/выхода в `toastVariants` (строка 26):
- Было: `slide-in-from-top-full` → `slide-in-from-bottom-full`
- Было: `sm:slide-in-from-bottom-full` → убрать медиа-условие

### Результат

- Все уведомления появляются снизу экрана
- Отступ `bottom-20` (~80px) не перекрывает нижнюю навигацию
- Анимация входа снизу вверх

