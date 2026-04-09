-- Create dieat management tables
-- This includes lifestyle logs, diet logs, goals, and settings.

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Diet Goals (To track historical goals)
CREATE TABLE IF NOT EXISTS diet_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  calories INTEGER DEFAULT 0,
  protein NUMERIC(10, 2) DEFAULT 0,
  fat NUMERIC(10, 2) DEFAULT 0,
  carbs NUMERIC(10, 2) DEFAULT 0,
  sugar NUMERIC(10, 2) DEFAULT 0,
  fiber NUMERIC(10, 2) DEFAULT 0,
  salt NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Diet Logs (Daily intake)
CREATE TABLE IF NOT EXISTS diet_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  calories INTEGER DEFAULT 0,
  protein NUMERIC(10, 2) DEFAULT 0,
  fat NUMERIC(10, 2) DEFAULT 0,
  carbs NUMERIC(10, 2) DEFAULT 0,
  sugar NUMERIC(10, 2) DEFAULT 0,
  fiber NUMERIC(10, 2) DEFAULT 0,
  salt NUMERIC(10, 2) DEFAULT 0,
  image_url TEXT, -- In case user wants to keep image (optional)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Lifestyle Logs (Daily metrics)
CREATE TABLE IF NOT EXISTS lifestyle_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight NUMERIC(10, 2), -- Weight is optional if user skips
  steps INTEGER DEFAULT 0,
  sleep_hours NUMERIC(10, 2) DEFAULT 0,
  water_liters NUMERIC(10, 2) DEFAULT 0,
  alcohol_units NUMERIC(10, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Lifestyle Settings (User preferences)
CREATE TABLE IF NOT EXISTS lifestyle_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  visible_items JSONB DEFAULT '{"steps": true, "sleep": true, "water": true, "alcohol": true}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_diet_goals_user_id ON diet_goals(user_id);
CREATE INDEX idx_diet_goals_start_date ON diet_goals(start_date);
CREATE INDEX idx_diet_logs_user_id_date ON diet_logs(user_id, date);
CREATE INDEX idx_lifestyle_logs_user_id_date ON lifestyle_logs(user_id, date);

-- Enable RLS
ALTER TABLE diet_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE diet_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE lifestyle_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE lifestyle_settings ENABLE ROW LEVEL SECURITY;

-- Helper function for Admin Check
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.jwt() ->> 'email' IN ('tandjgym@gmail.com', 'tandjgym2goutenn@gmail.com'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies

-- 1. Diet Goals Policies
CREATE POLICY "Users can see their own diet goals" ON diet_goals
  FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "Users can manage their own diet goals" ON diet_goals
  FOR ALL USING (auth.uid() = user_id OR is_admin());

-- 2. Diet Logs Policies
CREATE POLICY "Users can see their own diet logs" ON diet_logs
  FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "Users can manage their own diet logs" ON diet_logs
  FOR ALL USING (auth.uid() = user_id OR is_admin());

-- 3. Lifestyle Logs Policies
CREATE POLICY "Users can see their own lifestyle logs" ON lifestyle_logs
  FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "Users can manage their own lifestyle logs" ON lifestyle_logs
  FOR ALL USING (auth.uid() = user_id OR is_admin());

-- 4. Lifestyle Settings Policies
CREATE POLICY "Users can see their own settings" ON lifestyle_settings
  FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "Users can manage their own settings" ON lifestyle_settings
  FOR ALL USING (auth.uid() = user_id OR is_admin());
