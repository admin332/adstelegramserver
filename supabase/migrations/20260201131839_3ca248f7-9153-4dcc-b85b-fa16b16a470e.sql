-- Add draft_history column to store previous draft versions
ALTER TABLE deals ADD COLUMN IF NOT EXISTS draft_history jsonb DEFAULT '[]'::jsonb;