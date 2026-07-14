-- 筋トレ日・休養日でカロリー/PFC目標を切り替えるための追加項目
ALTER TABLE diet_goals
  ADD COLUMN IF NOT EXISTS day_type_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS training_calories INTEGER,
  ADD COLUMN IF NOT EXISTS training_protein NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS training_fat NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS training_carbs NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS training_sugar NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS training_fiber NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS training_salt NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS rest_calories INTEGER,
  ADD COLUMN IF NOT EXISTS rest_protein NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS rest_fat NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS rest_carbs NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS rest_sugar NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS rest_fiber NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS rest_salt NUMERIC(10, 2);

ALTER TABLE diet_logs
  ADD COLUMN IF NOT EXISTS day_type TEXT;

ALTER TABLE diet_logs
  DROP CONSTRAINT IF EXISTS diet_logs_day_type_check;

ALTER TABLE diet_logs
  ADD CONSTRAINT diet_logs_day_type_check
  CHECK (day_type IS NULL OR day_type IN ('training', 'rest'));

