

## План: Отображение названий категорий вместо ID

### Проблема

Сейчас в карточке канала и на странице канала отображается ID категории (например, `crypto`) вместо человекочитаемого названия (`Криптовалюты`).

### Места для исправления

| Файл | Строка | Текущее значение | Нужно |
|------|--------|------------------|-------|
| `ChannelCard.tsx` | 115 | `{category}` | `{getCategoryById(category)?.name \|\| category}` |
| `Channel.tsx` | 93 | `channel.category` | `getCategoryById(channel.category)?.name \|\| channel.category` |

### Изменения

#### 1. ChannelCard.tsx

Импортировать функцию и использовать для отображения:

```typescript
import { getCategoryById } from '@/data/channelCategories';

// В строке 115 изменить:
{getCategoryById(category)?.name || category}
```

#### 2. Channel.tsx

Импортировать функцию и использовать в статистике:

```typescript
import { getCategoryById } from '@/data/channelCategories';

// В detailedStats изменить:
{
  icon: Tag,
  label: 'Категория',
  value: getCategoryById(channel.category)?.name || channel.category,
}
```

### Изменяемые файлы

| Файл | Изменение |
|------|-----------|
| `src/components/ChannelCard.tsx` | Добавить импорт + использовать `getCategoryById` |
| `src/pages/Channel.tsx` | Добавить импорт + использовать `getCategoryById` |

### Результат

- Карточка канала показывает "Криптовалюты" вместо "crypto"
- Страница канала показывает "Криптовалюты" в статистике
- Если категория не найдена — fallback на оригинальное значение

