-- Add new columns to channels table for settings
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS accepted_campaign_types TEXT DEFAULT 'both';
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS min_hours_before_post INTEGER DEFAULT 0;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS auto_delete_posts BOOLEAN DEFAULT false;

-- Create favorites table for server-side tracking
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, channel_id)
);

-- Enable RLS on favorites
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- RLS policies for favorites
CREATE POLICY "Service role can manage favorites"
ON public.favorites
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can view own favorites"
ON public.favorites
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own favorites"
ON public.favorites
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own favorites"
ON public.favorites
FOR DELETE
USING (user_id = auth.uid());

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_channel_id ON public.favorites(channel_id);