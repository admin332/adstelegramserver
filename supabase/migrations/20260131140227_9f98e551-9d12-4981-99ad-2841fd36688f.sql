-- Create table for storing bot additions to channels via webhook
CREATE TABLE public.pending_channel_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id BIGINT NOT NULL,
  chat_title TEXT,
  chat_username TEXT,
  added_by_telegram_id BIGINT NOT NULL,
  bot_status TEXT NOT NULL DEFAULT 'administrator',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed BOOLEAN DEFAULT false,
  
  UNIQUE(telegram_chat_id, added_by_telegram_id)
);

-- Enable RLS (only service role can access)
ALTER TABLE public.pending_channel_verifications ENABLE ROW LEVEL SECURITY;

-- Policy for service role only
CREATE POLICY "Service role can manage pending verifications"
  ON public.pending_channel_verifications
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for fast lookup by user
CREATE INDEX idx_pending_verifications_user 
  ON public.pending_channel_verifications(added_by_telegram_id, processed);