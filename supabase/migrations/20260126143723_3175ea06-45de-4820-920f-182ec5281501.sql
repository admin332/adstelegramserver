-- Create channels table for channel owners
CREATE TABLE public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  telegram_chat_id bigint UNIQUE,
  username text NOT NULL,
  title text,
  description text,
  avatar_url text,
  subscribers_count integer DEFAULT 0,
  category text NOT NULL,
  -- Pricing
  price_1_24 numeric(10,2),
  price_2_48 numeric(10,2),
  price_post numeric(10,2),
  -- Status
  verified boolean DEFAULT false,
  bot_is_admin boolean DEFAULT false,
  is_active boolean DEFAULT true,
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create campaigns table for advertisers
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  image_url text,
  text text NOT NULL,
  button_text text,
  button_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on channels
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

-- Channels policies
CREATE POLICY "Anyone can view active channels"
  ON public.channels FOR SELECT
  USING (is_active = true);

CREATE POLICY "Service role can insert channels"
  ON public.channels FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update channels"
  ON public.channels FOR UPDATE
  USING (true);

-- Enable RLS on campaigns
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Campaigns policies
CREATE POLICY "Service role can insert campaigns"
  ON public.campaigns FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update campaigns"
  ON public.campaigns FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can view active campaigns"
  ON public.campaigns FOR SELECT
  USING (is_active = true);

-- Create indexes for better performance
CREATE INDEX idx_channels_owner_id ON public.channels(owner_id);
CREATE INDEX idx_channels_category ON public.channels(category);
CREATE INDEX idx_channels_verified ON public.channels(verified);
CREATE INDEX idx_campaigns_owner_id ON public.campaigns(owner_id);

-- Add trigger for updated_at on channels
CREATE TRIGGER update_channels_updated_at
  BEFORE UPDATE ON public.channels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger for updated_at on campaigns
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();