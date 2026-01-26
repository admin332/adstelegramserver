-- Add missing columns for channel statistics
ALTER TABLE public.channels 
  ADD COLUMN IF NOT EXISTS avg_views integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating numeric DEFAULT 4.5,
  ADD COLUMN IF NOT EXISTS engagement numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS successful_ads integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false;