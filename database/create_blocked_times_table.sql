-- Create blocked_times table for managing unavailable reservation periods
CREATE TABLE blocked_times (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    reason TEXT,
    calendar_id TEXT NOT NULL DEFAULT 'tandjgym@gmail.com',
    recurrence_type VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (recurrence_type IN ('none', 'daily', 'weekly')),
    recurrence_end DATE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_blocked_times_calendar_id ON blocked_times(calendar_id);
CREATE INDEX idx_blocked_times_start_time ON blocked_times(start_time);
CREATE INDEX idx_blocked_times_time_range ON blocked_times(start_time, end_time);

-- Add constraints
ALTER TABLE blocked_times ADD CONSTRAINT check_end_after_start 
    CHECK (end_time > start_time);

-- Add RLS policy for admin access
ALTER TABLE blocked_times ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can manage blocked times
CREATE POLICY "Admins can manage blocked times" ON blocked_times
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.email IN ('tandjgym@gmail.com', 'tandjgym2goutenn@gmail.com')
        )
    );

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_blocked_times_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_blocked_times_updated_at
    BEFORE UPDATE ON blocked_times
    FOR EACH ROW
    EXECUTE FUNCTION update_blocked_times_updated_at();
