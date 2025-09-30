-- Drop existing blocked_times table if it exists
DROP TABLE IF EXISTS blocked_times CASCADE;

-- Create blocked_times table
CREATE TABLE blocked_times (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    reason TEXT,
    calendar_id TEXT NOT NULL DEFAULT 'tandjgym@gmail.com',
    recurrence_type VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (recurrence_type IN ('none', 'daily', 'weekly')),
    recurrence_end DATE,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_blocked_times_calendar_id ON blocked_times(calendar_id);
CREATE INDEX idx_blocked_times_start_time ON blocked_times(start_time);

-- Add constraints
ALTER TABLE blocked_times ADD CONSTRAINT check_end_after_start 
    CHECK (end_time > start_time);

-- Enable RLS
ALTER TABLE blocked_times ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access
CREATE POLICY "Admin access to blocked_times" ON blocked_times
    FOR ALL USING (true);
