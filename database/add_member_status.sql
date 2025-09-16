-- Add status column to users table for member management
-- Status values: 'active' (在籍), 'suspended' (休会), 'withdrawn' (退会)

-- Add status column with default value 'active'
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

-- Add constraint to ensure only valid status values
ALTER TABLE users 
ADD CONSTRAINT users_status_check 
CHECK (status IN ('active', 'suspended', 'withdrawn'));

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Update existing users to have 'active' status
UPDATE users 
SET status = 'active' 
WHERE status IS NULL OR status = '';

-- Add comment for documentation
COMMENT ON COLUMN users.status IS 'Member status: active (在籍), suspended (休会), withdrawn (退会)';

-- Verify the changes
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'status';
