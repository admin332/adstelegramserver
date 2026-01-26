-- Добавить новую колонку для массива медиа
ALTER TABLE public.campaigns 
ADD COLUMN media_urls JSONB DEFAULT '[]'::jsonb;

-- Мигрировать существующие данные из image_url в массив
UPDATE public.campaigns 
SET media_urls = jsonb_build_array(image_url) 
WHERE image_url IS NOT NULL AND image_url != '';