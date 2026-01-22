-- Add transfer_day column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS transfer_day INTEGER CHECK (transfer_day >= 1 AND transfer_day <= 31);

-- Add comment
COMMENT ON COLUMN users.transfer_day IS 'Monthly transfer (payment) day for the member (1-31)';
