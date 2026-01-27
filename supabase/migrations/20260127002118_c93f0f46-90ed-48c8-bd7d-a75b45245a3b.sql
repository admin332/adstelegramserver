-- Add columns for post integrity tracking
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS telegram_message_id bigint;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS last_integrity_check_at timestamp with time zone;