-- Add trainer_external_event_id column to reservations table
-- This stores the Google Calendar event ID created on the trainer's personal calendar
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS trainer_external_event_id TEXT;
