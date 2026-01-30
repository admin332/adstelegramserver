-- Add columns for storing multiple drafts and message IDs
ALTER TABLE deals ADD COLUMN IF NOT EXISTS author_drafts jsonb DEFAULT '[]';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS telegram_message_ids jsonb DEFAULT '[]';

-- Add comment for documentation
COMMENT ON COLUMN deals.author_drafts IS 'Array of drafts for prompt campaigns: [{text, entities, media, approved, message_id, chat_id}]';
COMMENT ON COLUMN deals.telegram_message_ids IS 'Array of published message IDs for multi-post deals';