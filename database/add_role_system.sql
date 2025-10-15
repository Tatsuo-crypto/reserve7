-- Add role and access_token columns to users table

-- Add role column (ADMIN, STAFF, CLIENT)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'CLIENT' CHECK (role IN ('ADMIN', 'STAFF', 'CLIENT'));

-- Add access_token for token-based authentication (STAFF and CLIENT)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS access_token UUID DEFAULT uuid_generate_v4();

-- Add additional columns if not exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS plan VARCHAR(100),
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'withdrawn')),
ADD COLUMN IF NOT EXISTS monthly_fee INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS memo TEXT;

-- Create index for access_token
CREATE INDEX IF NOT EXISTS idx_users_access_token ON users(access_token);

-- Update existing admin users
UPDATE users 
SET role = 'ADMIN' 
WHERE email IN ('tandjgym@gmail.com', 'tandjgym2goutenn@gmail.com');

-- Make password_hash nullable for STAFF and CLIENT (they don't need passwords)
ALTER TABLE users 
ALTER COLUMN password_hash DROP NOT NULL;

-- Add constraint: ADMIN must have password
ALTER TABLE users
ADD CONSTRAINT check_admin_password 
CHECK (role != 'ADMIN' OR password_hash IS NOT NULL);

COMMENT ON COLUMN users.role IS 'User role: ADMIN (full access), STAFF (limited access), CLIENT (view only)';
COMMENT ON COLUMN users.access_token IS 'Token for URL-based authentication (STAFF and CLIENT)';
