-- Add access_token column to users table for passwordless client access
-- This allows clients to access their reservations via a unique URL without password

ALTER TABLE users ADD COLUMN IF NOT EXISTS access_token UUID DEFAULT uuid_generate_v4() UNIQUE;

-- Create index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_users_access_token ON users(access_token);

-- Update existing users to have access tokens
UPDATE users SET access_token = uuid_generate_v4() WHERE access_token IS NULL;

-- Make access_token NOT NULL after populating existing records
ALTER TABLE users ALTER COLUMN access_token SET NOT NULL;
