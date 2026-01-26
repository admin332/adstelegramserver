

## Цель
Добавить в раздел "Сделки" админ-панели отображение всех реальных сделок из базы данных и возможность админу менять статус каждой сделки.

## Текущее состояние

### База данных
- Таблица `deals` существует с 4 реальными сделками
- Доступные статусы: `pending`, `escrow`, `in_progress`, `completed`, `cancelled`, `disputed`, `expired`
- RLS: только владелец сделки может её видеть (`advertiser_id = auth.uid()`)

### Админ-панель
- В разделе "Сделки" сейчас заглушка: "Раздел сделок будет доступен после создания таблицы deals"
- Таблица уже существует, нужно добавить UI и RLS-доступ для админов

## Решение

### 1. Добавить RLS-политики для админов

```sql
-- Админы могут видеть все сделки
CREATE POLICY "Admins can view all deals"
ON public.deals FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Админы могут обновлять статус сделок
CREATE POLICY "Admins can update deals"
ON public.deals FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
```

### 2. Создать компонент `AdminDealsTable.tsx`

Структура компонента:
- Таблица со всеми сделками
- Колонки: Канал, Рекламодатель, Сумма, Статус, Дата создания, Действия
- Поиск по названию канала или имени рекламодателя
- Возможность изменить статус через dropdown

```text
src/components/admin/AdminDealsTable.tsx

Основные элементы:
├── Заголовок с количеством сделок и кнопкой обновления
├── Строка поиска
├── Таблица:
│   ├── Канал (название + username)
│   ├── Рекламодатель (имя + username)  
│   ├── Сумма (TON + USD эквивалент)
│   ├── Статус (цветной badge с иконкой)
│   ├── Дата создания
│   └── Действия (Select для смены статуса)
└── Состояния: загрузка, пустой список, ошибка
```

### 3. Интерфейс смены статуса

Select dropdown с опциями:
| Статус | Метка | Цвет |
|--------|-------|------|
| pending | Ожидает оплаты | yellow |
| escrow | Оплачено | blue |
| in_progress | Публикуется | primary |
| completed | Завершено | green |
| cancelled | Отменено | red |
| disputed | Спор | orange |
| expired | Истекло | gray |

При выборе нового статуса:
1. Вызов `supabase.from('deals').update({ status: newStatus }).eq('id', dealId)`
2. Toast-уведомление об успехе/ошибке
3. Рефетч данных таблицы

### 4. Подключить компонент в `Operator.tsx`

```tsx
case 'deals':
  return <AdminDealsTable />;
```

## Файлы для изменения

| Файл | Действие |
|------|----------|
| SQL миграция | Добавить RLS-политики для админов |
| `src/components/admin/AdminDealsTable.tsx` | Создать новый компонент |
| `src/pages/Operator.tsx` | Подключить компонент вместо заглушки |

## Технические детали

### Типы данных

```typescript
interface AdminDeal {
  id: string;
  status: DealStatus;
  total_price: number;
  posts_count: number;
  duration_hours: number;
  escrow_address: string | null;
  created_at: string;
  expires_at: string | null;
  channel: {
    title: string | null;
    username: string;
  } | null;
  advertiser: {
    first_name: string;
    username: string | null;
  } | null;
  campaign: {
    name: string;
  } | null;
}
```

### Запрос данных

```typescript
const { data, error } = await supabase
  .from('deals')
  .select(`
    id, status, total_price, posts_count, duration_hours,
    escrow_address, created_at, expires_at,
    channel:channels(title, username),
    advertiser:users!deals_advertiser_id_fkey(first_name, username),
    campaign:campaigns(name)
  `)
  .order('created_at', { ascending: false });
```

### Обновление статуса

```typescript
const updateStatus = async (dealId: string, newStatus: DealStatus) => {
  const { error } = await supabase
    .from('deals')
    .update({ status: newStatus })
    .eq('id', dealId);
    
  if (error) {
    toast({ title: "Ошибка", description: error.message, variant: "destructive" });
  } else {
    toast({ title: "Статус обновлён" });
    refetch();
  }
};
```

## UI дизайн

Таблица будет следовать стилю существующего `AdminUsersTable`:
- Тёмная тема с `bg-card` и `border-border`
- Строка поиска с иконкой Search
- Кнопка обновления с иконкой RefreshCw
- Статусы как цветные badges
- Select для смены статуса в последней колонке

