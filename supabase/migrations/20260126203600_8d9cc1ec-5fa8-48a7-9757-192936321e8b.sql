-- Enum для статуса сделки
CREATE TYPE deal_status AS ENUM (
  'pending',
  'escrow',
  'in_progress',
  'completed',
  'cancelled',
  'disputed'
);

-- Таблица deals для отслеживания сделок
CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id UUID NOT NULL REFERENCES public.users(id),
  channel_id UUID NOT NULL REFERENCES public.channels(id),
  campaign_id UUID REFERENCES public.campaigns(id),
  
  posts_count INTEGER NOT NULL DEFAULT 1,
  duration_hours INTEGER NOT NULL DEFAULT 24,
  price_per_post NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  
  scheduled_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  status deal_status NOT NULL DEFAULT 'pending',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Таблица reviews для верифицированных отзывов
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL UNIQUE REFERENCES public.deals(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.users(id),
  
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Добавить колонку reviews_count в channels
ALTER TABLE public.channels
ADD COLUMN IF NOT EXISTS reviews_count INTEGER DEFAULT 0;

-- Триггер для автоматического расчёта рейтинга
CREATE OR REPLACE FUNCTION public.update_channel_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.channels
  SET 
    rating = (
      SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 4.5)
      FROM public.reviews
      WHERE channel_id = COALESCE(NEW.channel_id, OLD.channel_id)
    ),
    reviews_count = (
      SELECT COUNT(*)::INTEGER
      FROM public.reviews
      WHERE channel_id = COALESCE(NEW.channel_id, OLD.channel_id)
    )
  WHERE id = COALESCE(NEW.channel_id, OLD.channel_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_update_channel_rating
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_channel_rating();

-- RLS для deals
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deals"
  ON public.deals FOR SELECT
  USING (advertiser_id = auth.uid());

CREATE POLICY "Service role can manage deals"
  ON public.deals FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS для reviews
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read reviews"
  ON public.reviews FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage reviews"
  ON public.reviews FOR ALL
  USING (true)
  WITH CHECK (true);

-- Индексы для производительности
CREATE INDEX idx_deals_advertiser_id ON public.deals(advertiser_id);
CREATE INDEX idx_deals_channel_id ON public.deals(channel_id);
CREATE INDEX idx_deals_status ON public.deals(status);
CREATE INDEX idx_reviews_channel_id ON public.reviews(channel_id);
CREATE INDEX idx_reviews_deal_id ON public.reviews(deal_id);