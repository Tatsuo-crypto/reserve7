-- Add access_token to trainers table for passwordless access
-- Trainers can access reservation and member management features

-- Add access_token column
ALTER TABLE trainers ADD COLUMN IF NOT EXISTS access_token UUID DEFAULT uuid_generate_v4() UNIQUE;

-- Create index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_trainers_access_token ON trainers(access_token);

-- Update existing trainers to have access tokens
UPDATE trainers SET access_token = uuid_generate_v4() WHERE access_token IS NULL;

-- Make access_token NOT NULL after populating existing records
ALTER TABLE trainers ALTER COLUMN access_token SET NOT NULL;

-- Change store_id from UUID to text (to match calendar_id format: email addresses)
ALTER TABLE trainers ALTER COLUMN store_id TYPE TEXT;
