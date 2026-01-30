

## Отключение верхнего отступа для Telegram Desktop

Добавим проверку платформы, чтобы синяя шапка и отступ показывались только на мобильных устройствах в Telegram.

---

## Что изменится

| Платформа | Сейчас | После |
|-----------|--------|-------|
| Телефон (iOS/Android) | Синяя шапка + отступ 2.5rem | Синяя шапка + отступ 2.5rem |
| Desktop/Web Telegram | Синяя шапка + отступ 2.5rem | Без шапки и отступа |
| Обычный браузер | Без шапки и отступа | Без шапки и отступа |

---

## Изменяемый файл

**src/App.tsx**

### Логика определения

Заменим простую проверку `isTelegramMiniApp()` на комбинированную проверку:
- Это Telegram Mini App **И** это мобильная платформа

### Изменения

```tsx
import { isTelegramMiniApp, isMobilePlatform } from "@/lib/telegram";

const App = () => {
  const [showTelegramHeader, setShowTelegramHeader] = useState(false);

  useEffect(() => {
    // Показываем шапку и отступ только для мобильных Telegram устройств
    setShowTelegramHeader(isTelegramMiniApp() && isMobilePlatform());
  }, []);

  return (
    // ...
    <div 
      className="app-container relative z-10" 
      style={{ paddingTop: showTelegramHeader ? '2.5rem' : '0' }}
    >
      {/* Синий заголовок только для мобильного Telegram */}
      {showTelegramHeader && (
        <div className="fixed top-0 left-0 right-0 h-10 z-50" style={{ backgroundColor: '#1484fb' }} />
      )}
      // ...
    </div>
  );
};
```

---

## Результат

| Устройство | Шапка | Отступ |
|------------|-------|--------|
| Telegram на телефоне | Синяя шапка | 2.5rem |
| Telegram на компьютере | Нет | 0 |
| Обычный браузер | Нет | 0 |

