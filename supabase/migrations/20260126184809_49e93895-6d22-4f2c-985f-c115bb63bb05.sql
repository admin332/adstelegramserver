-- Create ENUM for channel roles
CREATE TYPE public.channel_role AS ENUM ('owner', 'manager');

-- Create channel_admins table
CREATE TABLE public.channel_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  role channel_role NOT NULL DEFAULT 'manager',
  permissions JSONB DEFAULT '{"can_edit_posts": true, "can_view_stats": true, "can_view_finance": false, "can_withdraw": false}'::jsonb,
  telegram_member_status TEXT,
  last_verified_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (channel_id, user_id)
);

-- Enable RLS
ALTER TABLE public.channel_admins ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can manage all channel admins (for Edge Functions)
CREATE POLICY "Service role can manage channel admins"
ON public.channel_admins FOR ALL
USING (true) WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_channel_admins_updated_at
BEFORE UPDATE ON public.channel_admins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_channel_admins_channel_id ON public.channel_admins(channel_id);
CREATE INDEX idx_channel_admins_user_id ON public.channel_admins(user_id);