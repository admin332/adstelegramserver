-- Создать bucket для аватарок каналов
INSERT INTO storage.buckets (id, name, public)
VALUES ('channel-avatars', 'channel-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: разрешить публичное чтение
CREATE POLICY "Public can view channel avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'channel-avatars');

-- RLS: разрешить service role загружать/удалять
CREATE POLICY "Service role can manage channel avatars"
ON storage.objects FOR ALL
USING (bucket_id = 'channel-avatars');