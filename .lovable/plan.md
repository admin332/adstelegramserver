

## План: Изменения UI в Add Channel Wizard

### Изменения

#### 1. `src/pages/Create.tsx` (строка 72)

**Изменить заголовок "Добавить канал" на "Добавить":**

```tsx
// Было:
{selectedRole === "channel_owner" ? "Добавить канал" : "Новая кампания"}

// Станет:
{selectedRole === "channel_owner" ? "Добавить" : "Новая кампания"}
```

**Убрать кнопку назад сверху** (строки 64-70):

Убрать блок с кнопкой назад из header:
```tsx
// Убрать этот код:
<button 
  onClick={handleBack}
  className="absolute left-4 p-2 rounded-full hover:bg-secondary transition-colors"
>
  <ArrowLeft className="w-5 h-5 text-muted-foreground" />
</button>
```

---

#### 2. `src/components/create/AddChannelWizard.tsx`

**Добавить синюю обводку к кнопке "Назад" внизу** (строки 189 и 296):

```tsx
// Было:
<Button variant="outline" onClick={onBack} className="flex-1">

// Станет:
<Button variant="outline" onClick={onBack} className="flex-1 border-primary text-primary hover:bg-primary/10">
```

**Убрать четвёртый пункт инструкции** (строки 171-174):

Удалить этот блок из списка:
```tsx
<li className="flex gap-3">
  <span className="...">4</span>
  <span>Выдайте право «Публикация сообщений»</span>
</li>
```

---

### Итоговые изменения

| Файл | Изменение |
|------|-----------|
| `src/pages/Create.tsx` | Заголовок "Добавить канал" → "Добавить", убрать кнопку назад сверху |
| `src/components/create/AddChannelWizard.tsx` | Добавить `border-primary` к кнопкам "Назад", убрать 4-й пункт инструкции |

