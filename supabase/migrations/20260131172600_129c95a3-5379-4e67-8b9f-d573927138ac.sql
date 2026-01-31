-- Create table for storing user dialog states (e.g., awaiting revision comment)
CREATE TABLE IF NOT EXISTS public.telegram_user_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT NOT NULL UNIQUE,
  state_type TEXT NOT NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  draft_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '1 hour')
);

-- Enable RLS
ALTER TABLE public.telegram_user_states ENABLE ROW LEVEL SECURITY;

-- Service role only policy (edge functions use service role)
CREATE POLICY "Service role can manage telegram_user_states"
  ON public.telegram_user_states
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for fast lookup by telegram_user_id
CREATE INDEX idx_telegram_user_states_telegram_user_id 
  ON public.telegram_user_states(telegram_user_id);