-- Создать bucket для изображений кампаний
INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign-images', 'campaign-images', true);

-- Разрешить авторизованным пользователям загружать файлы
CREATE POLICY "Users can upload campaign images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'campaign-images');

-- Разрешить публичный доступ на чтение
CREATE POLICY "Public read access for campaign images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'campaign-images');

-- Разрешить владельцам удалять свои файлы
CREATE POLICY "Users can delete own campaign images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'campaign-images' AND auth.uid()::text = (storage.foldername(name))[1]);