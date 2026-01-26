

## План: Изменение стиля кнопок "Назад"

### Задача

Убрать синюю обводку и сделать текст белым для всех кнопок "Назад".

### Что изменится

| Было | Станет |
|------|--------|
| `border-primary text-primary hover:bg-primary/10` | `border-0 text-white hover:bg-white/10` |

### Файлы для изменения

| Файл | Количество кнопок |
|------|-------------------|
| `src/components/create/MyCampaignsList.tsx` | 1 |
| `src/components/create/MyChannelsList.tsx` | 1 |
| `src/components/create/AddChannelWizard.tsx` | 2 |
| `src/components/create/CreateCampaignForm.tsx` | 3 |

**Всего:** 7 кнопок

### Пример изменения

```tsx
// Было:
<Button 
  variant="outline" 
  className="... border-primary text-primary hover:bg-primary/10"
>

// Станет:
<Button 
  variant="outline" 
  className="... border-0 text-white hover:bg-white/10"
>
```

### Результат

- Кнопки "Назад" станут без обводки
- Текст и иконка станут белыми
- При наведении будет лёгкая белая подсветка

