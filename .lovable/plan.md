
# Принудительное завершение сделки из админ-панели с выплатой

## Задача

Когда админ вручную меняет статус сделки на "Завершено", нужно:
1. Пропустить проверку наличия поста
2. Выполнить перевод средств владельцу канала
3. Отправить уведомления обеим сторонам
4. Обновить статус на `completed`

## Решение

Создать новую Edge Function `admin-complete-deal` для принудительного завершения сделки, и вызывать её из админ-панели при смене статуса на `completed`.

## Изменения

### 1. Новая Edge Function: `admin-complete-deal/index.ts`

Логика:
- Проверка что вызывающий — админ (через `has_role`)
- Получение данных сделки, канала и владельца
- Перевод средств на кошелёк владельца (без проверки поста)
- Обновление статуса сделки на `completed`
- Отправка уведомлений в Telegram

```typescript
// Основная логика
async function forceCompleteDeal(dealId: string): Promise<Result> {
  // 1. Получить сделку с данными канала и владельца
  const deal = await getDealWithRelations(dealId);
  
  // 2. Получить кошелёк владельца канала
  const owner = await getOwner(deal.channel.owner_id);
  
  // 3. Перевести средства (без проверки поста)
  if (owner.wallet_address && deal.escrow_mnemonic_encrypted) {
    await transferToOwner(
      deal.escrow_mnemonic_encrypted,
      owner.wallet_address,
      deal.total_price
    );
  }
  
  // 4. Обновить статус
  await supabase.from("deals").update({
    status: "completed",
    completed_at: new Date().toISOString()
  }).eq("id", dealId);
  
  // 5. Увеличить счётчик успешных реклам
  await incrementSuccessfulAds(deal.channel_id);
  
  // 6. Отправить уведомления
  await notifyParties(deal, owner, advertiser);
  
  return { success: true };
}
```

### 2. Обновить `AdminDealsTable.tsx`

При смене статуса на `completed` вызывать новую Edge Function вместо простого обновления базы:

```typescript
const updateStatus = async (dealId: string, newStatus: DealStatus) => {
  setUpdatingDealId(dealId);
  try {
    if (newStatus === 'completed') {
      // Вызвать функцию завершения с выплатой
      const { data, error } = await supabase.functions.invoke('admin-complete-deal', {
        body: { dealId }
      });
      
      if (error) throw error;
      
      toast({
        title: 'Сделка завершена',
        description: data.transferSuccess 
          ? 'Средства переведены владельцу канала' 
          : 'Статус обновлён, но перевод не выполнен',
      });
    } else if (newStatus === 'escrow') {
      // Существующая логика уведомления
      // ...
    } else {
      // Простое обновление статуса
      const { error } = await supabase
        .from('deals')
        .update({ status: newStatus })
        .eq('id', dealId);
      if (error) throw error;
    }
    
    queryClient.invalidateQueries({ queryKey: ['admin-deals'] });
  } catch (err) {
    // ...
  }
};
```

## Файлы к изменению

| Файл | Изменение |
|------|-----------|
| `supabase/functions/admin-complete-deal/index.ts` | Новая функция завершения с выплатой |
| `src/components/admin/AdminDealsTable.tsx` | Вызов функции при смене на `completed` |

## Безопасность

- Edge Function проверяет что вызывающий имеет роль `admin`
- Используется `SUPABASE_SERVICE_ROLE_KEY` для доступа к зашифрованной мнемонике
- Транзакция TON происходит только на сервере

## Результат

- Админ выбирает "Завершено" в селекте
- Система переводит TON владельцу канала
- Увеличивается счётчик `successful_ads`
- Обе стороны получают уведомления в Telegram
- Сделка отмечается как завершённая
