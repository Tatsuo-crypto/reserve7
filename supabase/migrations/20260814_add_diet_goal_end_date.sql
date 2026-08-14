ALTER TABLE diet_goals
  ADD COLUMN IF NOT EXISTS end_date DATE;

CREATE INDEX IF NOT EXISTS idx_diet_goals_user_period
  ON diet_goals(user_id, start_date, end_date);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'diet_goals_end_date_after_start_date'
  ) THEN
    ALTER TABLE diet_goals
      ADD CONSTRAINT diet_goals_end_date_after_start_date
      CHECK (end_date IS NULL OR end_date >= start_date);
  END IF;
END $$;
