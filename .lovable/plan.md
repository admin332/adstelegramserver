
# Исправление удаления кампаний с историческими сделками

## Проблема

При попытке удалить кампанию возникает ошибка базы данных:
```
foreign key constraint "deals_campaign_id_fkey" on table "deals"
```

Кампания связана с таблицей `deals` через внешний ключ. Даже если сделки завершены (`completed`) или истекли (`expired`), удаление невозможно — FK constraint блокирует операцию.

## Текущая ситуация

С кампанией `c72b1239-8863-47e1-a42b-b75fd6412e64` связаны сделки:
| Статус | Количество |
|--------|------------|
| expired | 3 |
| completed | 1 |

Все сделки **неактивные**, но история сохраняется.

## Решение

Изменить поведение внешнего ключа на **ON DELETE SET NULL** — при удалении кампании поле `campaign_id` в сделках станет `NULL`, сохраняя историю сделок.

### Вариант 1: Изменить FK constraint (рекомендуется)

```sql
ALTER TABLE deals DROP CONSTRAINT deals_campaign_id_fkey;
ALTER TABLE deals ADD CONSTRAINT deals_campaign_id_fkey 
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;
```

**Плюсы:**
- История сделок сохраняется
- Удаление кампании работает всегда
- Можно видеть что сделка была "с удалённой кампанией"

### Вариант 2: Добавить проверку активных сделок

Запретить удаление если есть активные сделки (`pending`, `escrow`, `in_progress`), но разрешить если все завершены.

**Минусы:**
- Нужна дополнительная логика в Edge Function
- Всё равно нужно решать что делать с FK

## Рекомендуемое решение

1. **Миграция БД**: Изменить FK на `ON DELETE SET NULL`
2. **Edge Function**: Добавить проверку активных сделок перед удалением

```typescript
// В delete-campaign/index.ts
const { count: activeDeals } = await supabase
  .from("deals")
  .select("*", { count: "exact", head: true })
  .eq("campaign_id", campaign_id)
  .in("status", ["pending", "escrow", "in_progress"]);

if (activeDeals && activeDeals > 0) {
  return Response.json({ 
    success: false, 
    error: "Нельзя удалить кампанию с активными сделками" 
  });
}
```

## Изменяемые файлы

| Файл | Изменение |
|------|-----------|
| Миграция SQL | Изменить FK constraint |
| `supabase/functions/delete-campaign/index.ts` | Добавить проверку активных сделок |

## Результат

- Удаление кампаний с историческими сделками будет работать
- Нельзя удалить кампанию если есть активные сделки
- История сделок сохраняется (campaign_id становится NULL)
