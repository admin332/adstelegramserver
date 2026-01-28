

## Автоматическое управление Cron Jobs

### Идея

Cron jobs будут автоматически:
- **Включаться** при создании новой сделки
- **Отключаться** когда все сделки завершены/отменены

---

## Архитектура решения

```text
┌─────────────────────────────────────────────────────────────┐
│                    СОЗДАНИЕ СДЕЛКИ                           │
│                    (create-deal)                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  SQL: SELECT manage_cron_jobs('activate')                   │
│                                                              │
│  Проверяет: есть ли активные deals?                         │
│  Если jobs отключены → включает все                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 ЗАВЕРШЕНИЕ/ОТМЕНА СДЕЛКИ                     │
│  (complete-posted-deals, auto-refund-expired-deals)         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  SQL: SELECT manage_cron_jobs('check_and_deactivate')       │
│                                                              │
│  Проверяет: остались ли активные deals?                     │
│  Если нет активных → отключает все jobs                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Изменения в базе данных

### 1. Создать функцию управления cron jobs

```sql
CREATE OR REPLACE FUNCTION manage_cron_jobs(action text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_active_deals boolean;
  result json;
BEGIN
  -- Проверяем есть ли активные сделки
  SELECT EXISTS (
    SELECT 1 FROM deals 
    WHERE status IN ('pending', 'escrow', 'in_progress')
  ) INTO has_active_deals;

  IF action = 'activate' THEN
    -- Включаем все jobs
    UPDATE cron.job SET active = true 
    WHERE jobid IN (1, 3, 4, 5, 6);
    
    result := json_build_object(
      'action', 'activated',
      'jobs_affected', 5
    );
    
  ELSIF action = 'check_and_deactivate' THEN
    -- Отключаем только если нет активных сделок
    IF NOT has_active_deals THEN
      UPDATE cron.job SET active = false 
      WHERE jobid IN (1, 3, 4, 5, 6);
      
      result := json_build_object(
        'action', 'deactivated',
        'reason', 'no_active_deals'
      );
    ELSE
      result := json_build_object(
        'action', 'kept_active',
        'reason', 'has_active_deals'
      );
    END IF;
    
  ELSE
    result := json_build_object('error', 'unknown_action');
  END IF;
  
  RETURN result;
END;
$$;
```

---

## Изменения в Edge Functions

### 1. create-deal/index.ts

После успешного создания сделки:

```typescript
// После создания deal
await supabase.rpc('manage_cron_jobs', { action: 'activate' });
console.log("Cron jobs activated");
```

### 2. complete-posted-deals/index.ts

После обработки всех завершённых сделок:

```typescript
// В конце функции
await supabase.rpc('manage_cron_jobs', { action: 'check_and_deactivate' });
console.log("Checked and updated cron jobs status");
```

### 3. auto-refund-expired-deals/index.ts

После обработки всех возвратов:

```typescript
// В конце функции
await supabase.rpc('manage_cron_jobs', { action: 'check_and_deactivate' });
```

---

## Как это работает

| Событие | Действие |
|---------|----------|
| Новая сделка создана | `manage_cron_jobs('activate')` → все jobs включаются |
| Сделка завершена | `manage_cron_jobs('check_and_deactivate')` → если нет активных, jobs отключаются |
| Сделка отменена/возврат | `manage_cron_jobs('check_and_deactivate')` → аналогично |
| Новая сделка после простоя | `manage_cron_jobs('activate')` → jobs снова включаются |

---

## Преимущества

1. **Нулевые холостые вызовы** — когда нет сделок, функции не вызываются вообще
2. **Автоматика** — не нужно вручную включать/выключать
3. **Мгновенная реакция** — при создании сделки jobs сразу активны
4. **Экономия ресурсов** — особенно для `check-escrow-payments` (60 вызовов/час)

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| **База данных** | Создать функцию `manage_cron_jobs` |
| `supabase/functions/create-deal/index.ts` | Добавить вызов `rpc('manage_cron_jobs', {action: 'activate'})` |
| `supabase/functions/complete-posted-deals/index.ts` | Добавить вызов `rpc('manage_cron_jobs', {action: 'check_and_deactivate'})` |
| `supabase/functions/auto-refund-expired-deals/index.ts` | Добавить вызов `rpc('manage_cron_jobs', {action: 'check_and_deactivate'})` |

---

## Дополнительно: Текущее состояние

Сейчас можно сразу отключить jobs вручную, так как нет активных сделок:

```sql
UPDATE cron.job SET active = false WHERE jobid IN (1, 3, 4, 5, 6);
```

Они автоматически включатся при создании первой новой сделки.

