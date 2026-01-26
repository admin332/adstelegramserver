-- Добавить новое значение 'expired' в enum deal_status
ALTER TYPE deal_status ADD VALUE 'expired';

-- Добавить поле expires_at для отслеживания времени истечения сделки
ALTER TABLE deals ADD COLUMN expires_at timestamptz;