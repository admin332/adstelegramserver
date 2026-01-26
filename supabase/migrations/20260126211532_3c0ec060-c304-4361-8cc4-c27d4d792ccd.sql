-- Add wallet_address to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS wallet_address TEXT;

-- Add escrow fields to deals table
ALTER TABLE public.deals
ADD COLUMN IF NOT EXISTS escrow_address TEXT,
ADD COLUMN IF NOT EXISTS escrow_mnemonic_encrypted TEXT,
ADD COLUMN IF NOT EXISTS escrow_balance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMPTZ;

-- Create index for faster wallet lookups
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON public.users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_deals_escrow_address ON public.deals(escrow_address);