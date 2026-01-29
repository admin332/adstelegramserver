
# Добавление переключателя анимированного стикера в админ-панель

## Что будет сделано

Добавим возможность включать/выключать анимированный TGS-стикер на главной странице через админ-панель в разделе "Настройки".

## Изменения

### 1. База данных
Добавить новую запись в таблицу `app_settings`:
- `key`: `animated_sticker`
- `value`: `{ "enabled": true }` (включен по умолчанию)

### 2. Хук useAppSettings.ts
Расширить для работы с настройкой стикера:
- Добавить состояние `stickerEnabled` 
- Добавить функцию `updateStickerEnabled`
- Загружать обе настройки одним запросом

```typescript
// Новые поля в хуке
const [stickerEnabled, setStickerEnabled] = useState(true);

const updateStickerEnabled = async (enabled: boolean) => {
  // Обновление в app_settings
};
```

### 3. AdminSettings.tsx
Добавить новый переключатель в раздел "Режим разработки":

| Настройка | Описание |
|-----------|----------|
| Анимированный стикер | Показывать TGS-анимацию над первой карточкой канала на главной странице |

### 4. Index.tsx
Использовать настройку для условного отображения стикера:

```tsx
const { stickerEnabled } = useAppSettings();

// В JSX
{index === 0 && stickerEnabled && (
  <TgsSticker ... />
)}
```

## Изменяемые файлы

| Файл | Изменение |
|------|-----------|
| `src/hooks/useAppSettings.ts` | Добавить `stickerEnabled` и `updateStickerEnabled` |
| `src/components/admin/AdminSettings.tsx` | Добавить Switch для стикера |
| `src/pages/Index.tsx` | Условное отображение стикера |

## Миграция БД
```sql
INSERT INTO app_settings (key, value)
VALUES ('animated_sticker', '{"enabled": true}')
ON CONFLICT (key) DO NOTHING;
```
