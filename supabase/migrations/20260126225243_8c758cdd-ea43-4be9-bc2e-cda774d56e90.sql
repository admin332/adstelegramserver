-- Админы могут видеть все сделки
CREATE POLICY "Admins can view all deals"
ON public.deals FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Админы могут обновлять статус сделок
CREATE POLICY "Admins can update deals"
ON public.deals FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));