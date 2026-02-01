

## План: Анимированные числа в StatsCard

### Текущее состояние

| Аспект | Сейчас | Желаемое |
|--------|--------|----------|
| **Числа** | Статичные, сразу показываются | Анимация count-up при открытии |
| **Дизайн** | Простой | Более красивый, как в примере |
| **Пакеты** | `motion` уже установлен ✅ | Готово к использованию |

---

## Техническая реализация

### 1. Обновление компонента StatsCard

**Файл:** `src/components/StatsCard.tsx`

**Изменения:**
- Добавить анимацию count-up с помощью `animate` из `motion`
- Использовать `useRef` для привязки к DOM элементу
- Улучшить визуальный дизайн (иконка в цветном круге, более крупный метрик)

```typescript
import { ReactNode, useRef, useEffect } from "react";
import { animate } from "motion";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  numericValue?: number;  // Числовое значение для анимации
  trend?: number;
  className?: string;
  iconClassName?: string;  // Кастомный стиль для иконки
}

export const StatsCard = ({ 
  icon, 
  label, 
  value, 
  numericValue,
  trend, 
  className,
  iconClassName 
}: StatsCardProps) => {
  const valueRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = valueRef.current;
    if (!node || numericValue === undefined) return;

    // Анимация от 0 до целевого значения
    const controls = animate(0, numericValue, {
      duration: 1.5,
      ease: "easeOut",
      onUpdate(currentValue) {
        // Форматирование в зависимости от величины
        if (numericValue >= 1_000_000) {
          node.textContent = (currentValue / 1_000_000).toFixed(1) + 'M';
        } else if (numericValue >= 1_000) {
          node.textContent = (currentValue / 1_000).toFixed(1) + 'K';
        } else {
          node.textContent = Math.round(currentValue).toString();
        }
      },
    });

    return () => controls.stop();
  }, [numericValue]);

  return (
    <div className={cn(
      "bg-secondary/80 backdrop-blur-sm rounded-2xl p-4 border border-border/50",
      className
    )}>
      {/* Header с иконкой и названием */}
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(
          "p-2 rounded-xl",
          iconClassName || "bg-primary/10 text-primary"
        )}>
          {icon}
        </div>
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      
      {/* Метрика */}
      <div className="flex items-baseline gap-2">
        <span 
          ref={valueRef} 
          className="text-3xl font-bold text-foreground tracking-tight"
        >
          {value}
        </span>
        {trend !== undefined && (
          <span className={cn(
            "text-sm font-medium",
            trend >= 0 ? "text-green-500" : "text-destructive"
          )}>
            {trend >= 0 ? "+" : ""}{trend}%
          </span>
        )}
      </div>
    </div>
  );
};
```

### 2. Обновление использования в Index.tsx

**Файл:** `src/pages/Index.tsx`

Передавать `numericValue` для анимации:

```tsx
<StatsCard
  icon={<Users className="w-5 h-5" />}
  label="Каналов"
  value={formatNumber(totalChannels)}
  numericValue={totalChannels}  // ← Добавить для анимации
  iconClassName="bg-blue-500/10 text-blue-500"
/>
<StatsCard
  icon={<TrendingUp className="w-5 h-5" />}
  label="Подписчиков"
  value={formatNumber(totalSubscribers)}
  numericValue={totalSubscribers}  // ← Добавить для анимации
  iconClassName="bg-green-500/10 text-green-500"
/>
```

---

## Визуальные улучшения

| Элемент | До | После |
|---------|----|----|
| **Карточка** | `bg-secondary` | `bg-secondary/80 backdrop-blur-sm border border-border/50` |
| **Иконка** | Просто цвет | В цветном круге с фоном |
| **Число** | `text-2xl` | `text-3xl tracking-tight` + анимация |
| **Layout** | Иконка и label в одной строке | Иконка в круге, label рядом |

---

## Анимация

- **Тип:** Count-up от 0 до целевого значения
- **Длительность:** 1.5 секунды
- **Easing:** `easeOut` для плавного замедления в конце
- **Форматирование:** Автоматически добавляет K/M суффиксы во время анимации

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/components/StatsCard.tsx` | Полное обновление с анимацией и новым дизайном |
| `src/pages/Index.tsx` | Добавить `numericValue` и `iconClassName` пропсы |

