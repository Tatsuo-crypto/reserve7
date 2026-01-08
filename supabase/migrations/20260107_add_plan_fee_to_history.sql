-- Add plan and monthly_fee columns to membership_history table
ALTER TABLE membership_history 
ADD COLUMN IF NOT EXISTS plan TEXT,
ADD COLUMN IF NOT EXISTS monthly_fee INTEGER;

-- Comment on columns
COMMENT ON COLUMN membership_history.plan IS 'Snapshot of the plan at the time of status change';
COMMENT ON COLUMN membership_history.monthly_fee IS 'Snapshot of the monthly fee at the time of status change';
