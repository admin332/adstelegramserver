-- Добавить колонку для отслеживания последнего обновления статистики
ALTER TABLE public.channels 
ADD COLUMN IF NOT EXISTS stats_updated_at TIMESTAMPTZ DEFAULT now();

-- Установить текущее время для существующих записей (на основе updated_at)
UPDATE public.channels 
SET stats_updated_at = COALESCE(updated_at, now()) 
WHERE stats_updated_at IS NULL;