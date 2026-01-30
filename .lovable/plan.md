
## Улучшение визуализации пиковой активности (Area Chart)

Заменим примитивную сетку из 12 квадратиков на профессиональный Area Chart с градиентной заливкой, который показывает все 24 часа и выделяет пик активности.

---

## Текущая проблема

Сейчас показываются **только 12 часов** из 24, а самый большой пик (66 просмотров в 21:00 UTC) вообще не виден пользователю.

**Данные канала @slixone:**
- Пик: 21h (66) — 00:00 по Киеву
- Второй пик: 12h (43) — 15:00 по Киеву
- Минимум: 1h-4h (3-5) — глубокая ночь

---

## Что будем делать

### 1. Добавить Area Chart с Recharts

Создадим красивый график с градиентной заливкой:
- X-ось: часы (0h - 23h) 
- Y-ось: скрытая, значения видны в tooltip
- Градиент: от насыщенного синего (primary) сверху до прозрачного снизу
- Точки на пиках подсвечены

### 2. Добавить сдвиг часового пояса UTC → UTC+3

VPS отдает данные в UTC. Для украинской/российской аудитории нужен сдвиг:
```
displayHour = (hour + 3) % 24
```

### 3. Добавить блок "Лучшее время для публикации"

Автоматически находим час с максимальной активностью и выводим:
```
🎯 Лучшее время: 00:00 (UTC+3)
```

---

## Изменяемый файл

**src/components/channel/ChannelAnalytics.tsx**

### Добавить импорты
```typescript
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
```

### Добавить функцию подготовки данных
```typescript
// Shift hours from UTC to UTC+3 and sort
const prepareHoursData = (hours: TopHourStat[]) => {
  const shifted = hours.map(h => ({
    ...h,
    displayHour: (h.hour + 3) % 24,
  }));
  return shifted.sort((a, b) => a.displayHour - b.displayHour);
};
```

### Заменить блок Top Hours Heatmap (строки 250-298)

Вместо grid с квадратиками — Area Chart:

```typescript
{topHours && topHours.length > 0 && (() => {
  const chartData = prepareHoursData(topHours);
  const peakHour = chartData.reduce((max, h) => 
    h.value > max.value ? h : max, chartData[0]);
  
  return (
    <motion.div className="bg-secondary/50 rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <span className="font-medium">Пиковая активность</span>
        </div>
        <div className="flex items-center gap-1 text-primary text-sm">
          <span>🎯</span>
          <span className="font-semibold">
            {peakHour.displayHour.toString().padStart(2,'0')}:00
          </span>
        </div>
      </div>
      
      {/* Area Chart */}
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="displayHour" 
              tickFormatter={(h) => `${h}h`}
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              interval={3}
            />
            <YAxis hide />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload?.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-background border rounded-lg px-3 py-2 shadow-lg">
                      <p className="font-semibold">
                        {data.displayHour.toString().padStart(2,'0')}:00
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Активность: {data.value}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorActivity)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      <p className="text-xs text-muted-foreground text-center mt-2">
        Активность аудитории по часам (UTC+3)
      </p>
    </motion.div>
  );
})()}
```

---

## Визуальный результат

```text
╭─────────────────────────────────────────╮
│ ⏰ Пиковая активность          🎯 00:00 │
├─────────────────────────────────────────┤
│                              ▲          │
│                             ╱ ╲         │
│           ▲               ╱   ╲         │
│          ╱ ╲    ▲   ▲   ╱     ╲        │
│    ▲    ╱   ╲  ╱ ╲ ╱ ╲ ╱       ╲       │
│   ╱ ╲  ╱     ╲╱   ╲   ╲         ╲      │
│▔▔▔░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▔▔▔│
│ 0h   3h   6h   9h   12h  15h  18h  21h │
├─────────────────────────────────────────┤
│     Активность аудитории (UTC+3)        │
╰─────────────────────────────────────────╯
```

---

## После внедрения

1. Все 24 часа видны на графике
2. Пик активности выделен в шапке карточки 
3. Часовой пояс конвертирован для удобства (UTC+3)
4. Градиентная заливка создает профессиональный вид
5. Tooltip показывает точные данные при наведении
