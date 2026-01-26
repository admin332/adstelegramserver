
## План: Удаление пунктов меню из профиля

### Что нужно сделать

Удалить из страницы профиля два пункта меню:
- **Способы оплаты** (CreditCard)
- **Уведомления** (Bell)

### Изменения в файле

**Файл:** `src/pages/Profile.tsx`

1. Удалить из импортов иконки `Bell` и `CreditCard` (строки 14-15)

2. Обновить массив `menuItems` — убрать два объекта:

**Было:**
```typescript
const menuItems = [
  { icon: Wallet, label: "Кошелёк", description: "$1,250.00", action: true },
  { icon: CreditCard, label: "Способы оплаты", action: true },
  { icon: Bell, label: "Уведомления", action: true },
  { icon: Shield, label: "Безопасность", action: true },
  { icon: Settings, label: "Настройки", action: true },
  { icon: HelpCircle, label: "Помощь", action: true },
];
```

**Станет:**
```typescript
const menuItems = [
  { icon: Wallet, label: "Кошелёк", description: "$1,250.00", action: true },
  { icon: Shield, label: "Безопасность", action: true },
  { icon: Settings, label: "Настройки", action: true },
  { icon: HelpCircle, label: "Помощь", action: true },
];
```

### Результат

Меню профиля будет содержать 4 пункта:
- Кошелёк
- Безопасность
- Настройки
- Помощь
