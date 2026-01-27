-- 1. Добавить тип кампании в таблицу campaigns
ALTER TABLE public.campaigns 
ADD COLUMN campaign_type text NOT NULL DEFAULT 'ready_post';

-- 2. Добавить поля для черновика в таблицу deals
ALTER TABLE public.deals
ADD COLUMN author_draft text,
ADD COLUMN author_draft_media_urls jsonb DEFAULT '[]'::jsonb,
ADD COLUMN revision_count integer DEFAULT 0,
ADD COLUMN is_draft_approved boolean;

-- 3. Комментарии для документации
COMMENT ON COLUMN public.campaigns.campaign_type IS 'ready_post = готовый пост, prompt = автор пишет по брифу';
COMMENT ON COLUMN public.deals.is_draft_approved IS 'NULL = ожидает черновик, false = на доработке, true = одобрен';