const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function applyDietDayTypeTargetsMigration() {
  const sql = `
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
  `

  const { error } = await supabase.rpc('exec_sql', { sql })
  if (error) {
    console.error('SQL execution failed:', error)
    process.exit(1)
  }

  const { data, error: verifyError } = await supabase
    .from('diet_goals')
    .select('day_type_enabled, training_calories, rest_calories')
    .limit(1)

  if (verifyError) {
    console.error('Verification failed:', verifyError)
    process.exit(1)
  }

  console.log('Diet day type target columns are ready.', data)
}

applyDietDayTypeTargetsMigration()
