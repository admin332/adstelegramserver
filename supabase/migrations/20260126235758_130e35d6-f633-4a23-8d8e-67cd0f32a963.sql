-- Add cancellation_reason column to deals table
ALTER TABLE public.deals 
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.deals.cancellation_reason IS 'Reason for deal cancellation: owner_rejected, auto_expired, advertiser_cancelled';