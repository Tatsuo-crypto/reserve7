-- Add missing columns to lifestyle_settings table
ALTER TABLE lifestyle_settings ADD COLUMN IF NOT EXISTS quit_goals JSONB DEFAULT '[]'::jsonb;
ALTER TABLE lifestyle_settings ADD COLUMN IF NOT EXISTS habit_targets JSONB DEFAULT '{"steps": 8000, "sleep": 7, "water": 2}'::jsonb;
