-- Add quit_goals column to lifestyle_settings table
ALTER TABLE lifestyle_settings ADD COLUMN IF NOT EXISTS quit_goals JSONB DEFAULT '[]'::jsonb;
