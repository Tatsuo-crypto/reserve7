-- Add google_calendar_id to trainers table
ALTER TABLE trainers
ADD COLUMN google_calendar_id TEXT;

-- Add index for google_calendar_id for faster lookups if needed
CREATE INDEX idx_trainers_google_calendar_id ON trainers(google_calendar_id);
