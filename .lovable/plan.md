
# Замена захардкоженного рейтинга в блоке пользователя

## Проблема

В карточке пользователя под ником отображается статический рейтинг "4.9" (строка 138), хотя реальные данные уже загружаются через `useAdvertiserStats`.

## Текущий код (строки 136-142)

```tsx
<div className="flex items-center gap-1 mt-1">
  <Star className="w-4 h-4 text-warning fill-warning" />
  <span className="text-sm text-foreground">4.9</span>  ← захардкожено
  {isAuthenticated && (
    <span className="text-sm text-muted-foreground">• Проверен</span>
  )}
</div>
```

## Решение

Заменить `4.9` на динамическое значение:
- В тестовом режиме → `demoStats.avgRating` (4.8)
- В реальном режиме → `advertiserStats?.avgRating ?? 0`
- При загрузке → показывать "..."

## Изменения

**Файл:** `src/pages/Profile.tsx`

**Строка 138** — заменить:
```tsx
<span className="text-sm text-foreground">4.9</span>
```

На:
```tsx
<span className="text-sm text-foreground">
  {statsLoading ? "..." : (isTestMode ? demoStats.avgRating : (advertiserStats?.avgRating ?? 0))}
</span>
```

## Результат

| Режим | Отображение |
|-------|-------------|
| Загрузка | `...` |
| Тестовый режим | `4.8` (демо) |
| Реальный (без отзывов) | `0` |
| Реальный (с отзывами) | Средний рейтинг |
