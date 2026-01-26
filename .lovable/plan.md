

## План: Скрытие полей для существующих каналов и изменение текста кнопки

### Задача
При добавлении канала, который уже существует в системе, скрыть выбор категории и стоимости, а текст кнопки изменить на "Я менеджер".

---

### Изменения в AddChannelWizard.tsx

**1. Добавить состояние для отслеживания существующего канала:**
```typescript
const [isExistingChannel, setIsExistingChannel] = useState(false);
```

**2. Обновить debounce-эффект (preview-channel):**

При получении превью канала проверять, есть ли он уже в базе:
```typescript
// В ответе от preview-channel добавить флаг exists
if (data.success) {
  setChannelPreview({
    avatar_url: data.avatar_url,
    title: data.title,
  });
  setIsExistingChannel(data.exists || false); // Новый флаг
}
```

**3. Условно скрыть категорию и цены (Step 2):**

```typescript
{/* Категория — скрыть если канал существует */}
{!isExistingChannel && (
  <div className="space-y-2">
    <Label>Категория</Label>
    <Select ...>
      ...
    </Select>
  </div>
)}

{/* Стоимость — скрыть если канал существует */}
{!isExistingChannel && (
  <div className="space-y-2">
    <Label>Стоимость размещения (TON за пост)</Label>
    ...
  </div>
)}
```

**4. Изменить текст кнопки:**

```typescript
<Button 
  onClick={handleVerifyChannel} 
  className="flex-1"
  disabled={isVerifying || !channelData.username || (!isExistingChannel && !channelData.category)}
>
  {isVerifying ? (
    <>
      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      Проверка...
    </>
  ) : isExistingChannel ? (
    <>
      Я менеджер
      <ArrowRight className="w-4 h-4 ml-2" />
    </>
  ) : (
    <>
      Проверить канал
      <ArrowRight className="w-4 h-4 ml-2" />
    </>
  )}
</Button>
```

**5. Обновить валидацию:**

Убрать проверку категории, если канал существует:
```typescript
disabled={isVerifying || !channelData.username || (!isExistingChannel && !channelData.category)}
```

**6. Обновить handleVerifyChannel:**

Не требовать категорию для существующих каналов:
```typescript
if (!cleanUsername) {
  toast({
    title: "Укажите канал",
    description: "Введите username канала",
    variant: "destructive",
  });
  return;
}

// Требуем категорию только для новых каналов
if (!isExistingChannel && !channelData.category) {
  toast({
    title: "Выберите категорию",
    description: "Категория обязательна для нового канала",
    variant: "destructive",
  });
  return;
}
```

---

### Обновление Edge Function preview-channel

Добавить проверку существования канала в базе:

```typescript
// В preview-channel добавить:
const { data: existingChannel } = await supabase
  .from("channels")
  .select("id")
  .eq("username", cleanUsername)
  .maybeSingle();

return new Response(JSON.stringify({
  success: true,
  avatar_url: avatarUrl,
  title: chatInfo.title,
  exists: !!existingChannel, // Новый флаг
}));
```

---

### Результат

| Сценарий | Категория | Стоимость | Кнопка |
|----------|-----------|-----------|--------|
| Новый канал | Показать | Показать | "Проверить канал" |
| Существующий канал | Скрыть | Скрыть | "Я менеджер" |

