-- Удалить старую политику
DROP POLICY IF EXISTS "View channels" ON public.channels;

-- Создать новую политику с учётом channel_admins
CREATE POLICY "View channels" ON public.channels
FOR SELECT
TO authenticated
USING (
  -- Владелец видит все свои каналы
  owner_id = auth.uid()
  OR
  -- Админы/менеджеры видят каналы, к которым имеют доступ
  id IN (
    SELECT channel_id FROM public.channel_admins WHERE user_id = auth.uid()
  )
  OR
  -- Публичные активные верифицированные каналы
  (is_active = true AND verified = true)
);