

## Обзор

Убрать отдельные кнопки для открытия @adsingo_bot и @kjeuz, сделав ники в инструкции кликабельными ссылками.

---

## Изменения

### AddChannelWizard.tsx (строки 272-302)

**1. Превратить ники в кликабельные ссылки в инструкции:**

Строка 274 — заменить текст на ссылку:
```tsx
<span>Добавьте <a href="https://t.me/adsingo_bot" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">@adsingo_bot</a> как администратора</span>
```

Строка 278 — заменить текст на ссылку:
```tsx
<span>Добавьте <a href="https://t.me/kjeuz" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">@kjeuz</a> как администратора (для детальной аналитики)</span>
```

**2. Удалить блок с кнопками (строки 283-302):**

Полностью удалить секцию:
```tsx
<div className="flex gap-3">
  <a href="https://t.me/adsingo_bot" ...>...</a>
  <a href="https://t.me/kjeuz" ...>...</a>
</div>
```

---

## Результат

Инструкция будет выглядеть так:
1. Откройте настройки вашего канала в Telegram
2. Перейдите в раздел «Администраторы»
3. Добавьте **@adsingo_bot** ← кликабельно
4. Добавьте **@kjeuz** ← кликабельно

При нажатии на ник откроется соответствующий профиль в Telegram.

