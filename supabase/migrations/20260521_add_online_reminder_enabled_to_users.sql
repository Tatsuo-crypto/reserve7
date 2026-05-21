-- Add online_reminder_enabled column to users table to select which members receive reminders
ALTER TABLE users ADD COLUMN IF NOT EXISTS online_reminder_enabled BOOLEAN DEFAULT false;
