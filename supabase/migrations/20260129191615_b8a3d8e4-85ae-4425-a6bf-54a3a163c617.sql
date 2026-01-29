-- Add new columns for storing native Telegram data (file_id + entities)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS author_draft_entities JSONB DEFAULT '[]';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS author_draft_media JSONB DEFAULT '[]';

-- Add comment for documentation
COMMENT ON COLUMN deals.author_draft_entities IS 'Telegram message entities for formatting (bold, italic, links, premium emoji)';
COMMENT ON COLUMN deals.author_draft_media IS 'Array of {type, file_id} objects for permanent Telegram media storage';