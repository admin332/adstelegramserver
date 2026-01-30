

## Добавление детального логирования в refresh-channel-stats

Цель: увидеть сырые данные `topHours` и `languageStats` от VPS перед парсингом, чтобы понять что именно приходит.

---

## Изменения

### 1. refresh-channel-stats/index.ts (после строки 331)

Добавить логирование raw данных сразу после получения `mtprotoData.stats`:

```typescript
if (mtprotoData.stats) {
  // === ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ RAW ДАННЫХ ===
  console.log(`[refresh] RAW languageStats:`, JSON.stringify(mtprotoData.stats.languageStats));
  console.log(`[refresh] RAW topHours:`, JSON.stringify(mtprotoData.stats.topHours));
  console.log(`[refresh] RAW stats keys:`, Object.keys(mtprotoData.stats));
  
  // Если topHours есть, показать структуру первого элемента
  if (mtprotoData.stats.topHours?.length > 0) {
    const firstItem = mtprotoData.stats.topHours[0];
    console.log(`[refresh] topHours[0] keys:`, Object.keys(firstItem));
    console.log(`[refresh] topHours[0] full:`, JSON.stringify(firstItem));
  }
  // === КОНЕЦ ЛОГИРОВАНИЯ ===
  
  // Languages: { label, value } → { language, percentage }
  // ... остальной код парсинга
}
```

---

## Действия после применения

1. Деплой Edge Function `refresh-channel-stats`
2. Сбросить `stats_updated_at = NULL` для канала @slixone
3. Открыть страницу канала чтобы триггернуть обновление
4. Проверить логи — теперь будет видно:
   - Какие ключи приходят от VPS
   - Полная структура `topHours[0]`
   - Содержимое `languageStats`

---

## Техническая информация

Логи покажут один из следующих сценариев:

| Сценарий | Что увидим в логах |
|----------|-------------------|
| VPS отдаёт данные | `RAW topHours: [{"x":1234567890,"Top Hours":150},...]` |
| Telegram не отдаёт | `RAW topHours: []` или `RAW topHours: null` |
| VPS парсит неверно | `RAW topHours: [{"x":123}]` (без value-ключей) |

Это позволит точно диагностировать проблему.

