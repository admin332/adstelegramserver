-- Add draft_submitted_at column to track when owner submits draft for advertiser review
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS draft_submitted_at TIMESTAMPTZ DEFAULT NULL;