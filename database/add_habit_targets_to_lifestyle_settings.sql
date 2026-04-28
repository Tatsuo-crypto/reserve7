-- Add habit_targets column to lifestyle_settings table
ALTER TABLE lifestyle_settings ADD COLUMN IF NOT EXISTS habit_targets JSONB DEFAULT '{"steps": 8000, "sleep": 7, "water": 2}'::jsonb;
