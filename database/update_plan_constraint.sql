-- Drop the existing constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS check_plan_values;

-- Add the updated constraint with all allowed plan values including '都度'
ALTER TABLE users ADD CONSTRAINT check_plan_values 
CHECK (plan IN (
  '都度',
  '月2回', 
  '月4回', 
  '月6回', 
  '月8回', 
  'ダイエットコース',
  'ダイエットコース【2ヶ月】',
  'ダイエットコース【3ヶ月】',
  'ダイエットコース【6ヶ月】',
  'カウンセリング'
));
