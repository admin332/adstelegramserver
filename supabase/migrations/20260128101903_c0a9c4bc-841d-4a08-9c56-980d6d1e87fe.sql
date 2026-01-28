-- Таблица для хранения отзывов о рекламодателях
CREATE TABLE public.advertiser_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  advertiser_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT unique_deal_advertiser_review UNIQUE (deal_id)
);

-- Включаем RLS
ALTER TABLE public.advertiser_reviews ENABLE ROW LEVEL SECURITY;

-- Политики RLS
-- Публичный доступ на чтение (отзывы публичны)
CREATE POLICY "Public can read advertiser reviews"
  ON public.advertiser_reviews
  FOR SELECT
  USING (true);

-- Только service role может вставлять (через webhook)
CREATE POLICY "Service role can manage advertiser reviews"
  ON public.advertiser_reviews
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Индекс для быстрого поиска по advertiser_id
CREATE INDEX idx_advertiser_reviews_advertiser_id ON public.advertiser_reviews(advertiser_id);