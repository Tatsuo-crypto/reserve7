-- Create trainer_shift_templates table
CREATE TABLE IF NOT EXISTS trainer_shift_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 1=Monday, ...
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create trainer_shifts table
CREATE TABLE IF NOT EXISTS trainer_shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Add constraint to ensure end_time > start_time
  CONSTRAINT shifts_check_time_validity CHECK (end_time > start_time)
);

-- Add indexes for performance
CREATE INDEX idx_trainer_shift_templates_trainer_id ON trainer_shift_templates(trainer_id);
CREATE INDEX idx_trainer_shifts_trainer_id ON trainer_shifts(trainer_id);
CREATE INDEX idx_trainer_shifts_time_range ON trainer_shifts(start_time, end_time);
