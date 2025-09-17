-- Add plan column to users table
ALTER TABLE users ADD COLUMN plan VARCHAR(50) DEFAULT '月4回';

-- Update existing users with default plan
UPDATE users SET plan = '月4回' WHERE plan IS NULL;

-- Add constraint to ensure valid plan values
ALTER TABLE users ADD CONSTRAINT check_plan_values 
CHECK (plan IN ('月2回', '月4回', '月6回', '月8回', 'ダイエットコース'));
