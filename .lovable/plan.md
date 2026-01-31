

## Добавление иконки категории и ограничение длины названия

---

## Изменения

### 1. `src/components/ChannelCard.tsx`

**Добавить иконку категории в бейдж:**

Функция `getCategoryById` уже возвращает объект с `icon` (LucideIcon). Нужно использовать его:

```tsx
// Строка 135-137, заменить:
<div className="bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-full w-fit">
  {getCategoryById(category)?.name || category}
</div>

// На:
<div className="bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-full w-fit flex items-center gap-1">
  {(() => {
    const cat = getCategoryById(category);
    const Icon = cat?.icon;
    return (
      <>
        {Icon && <Icon className="w-3 h-3" />}
        <span>{cat?.name || category}</span>
      </>
    );
  })()}
</div>
```

**Ограничить длину названия канала:**

Сейчас используется `truncate` для обрезки (строка 182), но можно добавить явное ограничение с `max-w-[...]` или программную обрезку текста.

Текущий класс:
```tsx
className="text-white font-bold text-lg truncate"
```

Добавить `max-w-[140px]` для ограничения ширины (примерно на 4 символа меньше):
```tsx
className="text-white font-bold text-lg truncate max-w-[140px]"
```

---

## Визуальный результат

**Категория с иконкой:**
```
[❤️ Лайфстайл]
```

**Название канала:**
```
FitLife Rus...  (вместо FitLife Russia...)
```

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/components/ChannelCard.tsx` | Добавить иконку в бейдж категории, добавить `max-w-[140px]` к названию |

