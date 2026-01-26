-- Политика: пользователи могут читать свои записи в channel_admins
CREATE POLICY "Users can view own admin entries"
  ON public.channel_admins
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Политика: пользователи могут читать админов каналов, где сами админы
CREATE POLICY "Channel admins can view co-admins"
  ON public.channel_admins
  FOR SELECT
  TO authenticated
  USING (
    channel_id IN (
      SELECT ca.channel_id 
      FROM public.channel_admins ca 
      WHERE ca.user_id = auth.uid()
    )
  );