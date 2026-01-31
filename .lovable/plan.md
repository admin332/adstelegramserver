

## Валидация цен: только целые числа 1-100000 TON

---

## Обзор

Добавить валидацию для полей ввода стоимости размещения:
- Только целые числа (без запятых и точек)
- Минимум: 1 TON
- Максимум: 100000 TON

---

## Места изменений

| Файл | Строки | Описание |
|------|--------|----------|
| `src/pages/ChannelSettings.tsx` | 192-218 | Настройки канала (price_1_24, price_2_48) |
| `src/components/create/AddChannelWizard.tsx` | 581-614 | Автообнаруженный канал |
| `src/components/create/AddChannelWizard.tsx` | 716-747 | Ручной ввод |

---

## Изменения

### 1. Утилита валидации цены

Создадим функцию-хелпер для обработки ввода:

```typescript
// Валидация цены: только целые числа 1-100000
const validatePriceInput = (value: string): string => {
  // Убираем все нецифровые символы
  const cleaned = value.replace(/[^0-9]/g, '');
  
  if (!cleaned) return '';
  
  const num = parseInt(cleaned, 10);
  
  // Ограничиваем максимум
  if (num > 100000) return '100000';
  
  return cleaned;
};
```

### 2. ChannelSettings.tsx

**Изменения в Input полях:**

```tsx
// Было:
<Input
  type="number"
  step="0.1"
  min="0"
  value={localSettings.price_1_24 ?? ''}
  onChange={(e) => handleSettingChange('price_1_24', e.target.value ? parseFloat(e.target.value) : null)}
  ...
/>

// Станет:
<Input
  type="text"
  inputMode="numeric"
  pattern="[0-9]*"
  value={localSettings.price_1_24?.toString() ?? ''}
  onChange={(e) => {
    const validated = validatePriceInput(e.target.value);
    handleSettingChange('price_1_24', validated ? parseInt(validated, 10) : null);
  }}
  placeholder="1-100000"
  ...
/>
```

**Добавить валидацию при сохранении:**

```typescript
const handleSave = () => {
  if (!id || !hasChanges) return;
  
  // Валидация минимального значения
  if (localSettings.price_1_24 !== null && localSettings.price_1_24 < 1) {
    toast({
      title: "Ошибка",
      description: "Минимальная цена: 1 TON",
      variant: "destructive",
    });
    return;
  }
  if (localSettings.price_2_48 !== null && localSettings.price_2_48 < 1) {
    toast({
      title: "Ошибка",
      description: "Минимальная цена: 1 TON",
      variant: "destructive",
    });
    return;
  }
  
  updateSettings.mutate(...);
};
```

### 3. AddChannelWizard.tsx

**Добавить хелпер в начало компонента:**

```typescript
// После строки const { tonPrice } = useTonPrice();
const validatePriceInput = (value: string): string => {
  const cleaned = value.replace(/[^0-9]/g, '');
  if (!cleaned) return '';
  const num = parseInt(cleaned, 10);
  if (num > 100000) return '100000';
  return cleaned;
};
```

**Изменить обработчики onChange (4 поля):**

```tsx
// Автообнаруженный канал - price_1_24 (строка ~585)
<Input
  type="text"
  inputMode="numeric"
  pattern="[0-9]*"
  placeholder={selectedChannel.recommended_price_24?.toString() || "0"}
  value={channelData.price_1_24}
  onChange={(e) => setChannelData({ 
    ...channelData, 
    price_1_24: validatePriceInput(e.target.value) 
  })}
  className="bg-card border-0"
/>

// Автообнаруженный канал - price_2_48 (строка ~604)
<Input
  type="text"
  inputMode="numeric"
  pattern="[0-9]*"
  ...
  onChange={(e) => setChannelData({ 
    ...channelData, 
    price_2_48: validatePriceInput(e.target.value) 
  })}
/>

// Ручной ввод - price_1_24 (строка ~720)
<Input
  type="text"
  inputMode="numeric"
  pattern="[0-9]*"
  ...
  onChange={(e) => setChannelData({ 
    ...channelData, 
    price_1_24: validatePriceInput(e.target.value) 
  })}
/>

// Ручной ввод - price_2_48 (строка ~737)
<Input
  type="text"
  inputMode="numeric"
  pattern="[0-9]*"
  ...
  onChange={(e) => setChannelData({ 
    ...channelData, 
    price_2_48: validatePriceInput(e.target.value) 
  })}
/>
```

**Валидация при верификации:**

```typescript
const handleVerifyChannel = async () => {
  // Добавить проверку минимума
  const price1 = channelData.price_1_24 ? parseInt(channelData.price_1_24, 10) : 0;
  const price2 = channelData.price_2_48 ? parseInt(channelData.price_2_48, 10) : 0;
  
  if (price1 > 0 && price1 < 1) {
    toast({
      title: "Ошибка",
      description: "Минимальная цена: 1 TON",
      variant: "destructive",
    });
    return;
  }
  // ... остальная логика
};
```

---

## Поведение UI

| Ввод пользователя | Результат |
|-------------------|-----------|
| `123` | ✅ `123` |
| `123.45` | ✅ `12345` (точка удалена) |
| `123,67` | ✅ `12367` (запятая удалена) |
| `abc` | ✅ `` (только цифры) |
| `150000` | ✅ `100000` (ограничено max) |
| `0` | ⚠️ При сохранении: "Минимальная цена: 1 TON" |

---

## Техническая реализация

- `type="text"` вместо `type="number"` — позволяет полностью контролировать ввод
- `inputMode="numeric"` — открывает числовую клавиатуру на мобильных
- `pattern="[0-9]*"` — подсказка для браузера
- Валидация в onChange — мгновенная обратная связь
- Валидация при сохранении — проверка минимума

---

## Файлы для изменения

| Файл | Действие |
|------|----------|
| `src/pages/ChannelSettings.tsx` | Обновить оба Input для price_1_24 и price_2_48 |
| `src/components/create/AddChannelWizard.tsx` | Обновить 4 Input поля + добавить валидатор |

