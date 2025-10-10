-- Add monthly_fee column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_fee INTEGER DEFAULT 0;

-- Add comment
COMMENT ON COLUMN users.monthly_fee IS '会員の月会費（円）';

-- Update existing records with default values based on plan
UPDATE users
SET monthly_fee = CASE
  WHEN plan = '月2回' THEN 13200
  WHEN plan = '月4回' THEN 26400
  WHEN plan = '月6回' THEN 39600
  WHEN plan = '月8回' THEN 52800
  WHEN plan = 'ダイエットコース' THEN 66000
  ELSE 0
END
WHERE monthly_fee = 0 OR monthly_fee IS NULL;
