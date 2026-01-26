

## План: Унификация категорий каналов

### Проблема

Сейчас есть **три разных источника категорий**, которые не синхронизированы:

| Файл | ID игр | ID крипты | Название крипты |
|------|--------|-----------|-----------------|
| `channelCategories.ts` | `games` | `crypto` | Криптовалюты |
| `CategoryFilters.tsx` | `gaming` | `crypto` | Крипто |
| `getCategoryName()` | `gaming` | `crypto` | Крипто |

### Ошибка в логике фильтрации

В `Channels.tsx` и `Index.tsx` логика сравнения неверная:

```typescript
// Канал хранит ID категории: "crypto"
channel.category.toLowerCase() === getCategoryName(activeCategory).toLowerCase()
// "crypto" === "крипто" → false!
```

Нужно сравнивать **ID с ID**, а не ID с названием.

### Решение

#### 1. Унифицировать категории

Использовать **единый источник** — `channelCategories.ts` — во всех местах.

Обновить `channelCategories.ts`:
- Добавить недостающие категории (`food`, `travel`, `music`)
- Унифицировать ID: `games` вместо `gaming`
- Добавить "Все" как опцию для фильтров

#### 2. Обновить CategoryFilters.tsx

Импортировать категории из `channelCategories.ts` вместо локального массива.

#### 3. Исправить логику фильтрации

В `Index.tsx` и `Channels.tsx` изменить сравнение:

Было:
```typescript
channel.category.toLowerCase() === getCategoryName(activeCategory).toLowerCase()
```

Станет:
```typescript
channel.category === activeCategory
```

### Изменяемые файлы

| Файл | Изменение |
|------|-----------|
| `src/data/channelCategories.ts` | Добавить недостающие категории (food, travel, music) и опцию "Все" |
| `src/components/CategoryFilters.tsx` | Импортировать из единого источника |
| `src/pages/Index.tsx` | Исправить логику фильтрации на сравнение ID |
| `src/pages/Channels.tsx` | Исправить логику фильтрации на сравнение ID |

### Итоговый список категорий

```text
all       → Все
crypto    → Криптовалюты
tech      → Технологии
marketing → Маркетинг
business  → Бизнес
games     → Игры
lifestyle → Лайфстайл
news      → Новости
entertainment → Развлечения
education → Образование
food      → Еда
travel    → Путешествия
music     → Музыка
other     → Другое
```

### Результат

- Единый источник категорий для всего приложения
- Фильтрация работает корректно по ID категории
- При добавлении канала и при фильтрации используются одинаковые категории

