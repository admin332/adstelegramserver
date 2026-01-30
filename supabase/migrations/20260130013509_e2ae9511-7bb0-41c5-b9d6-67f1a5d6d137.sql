-- Add new columns for views and shares per post statistics
ALTER TABLE public.channels 
ADD COLUMN IF NOT EXISTS views_per_post numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS shares_per_post numeric DEFAULT NULL;