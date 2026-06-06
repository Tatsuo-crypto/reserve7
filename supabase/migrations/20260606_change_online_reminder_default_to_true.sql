-- Update default value of online_reminder_enabled to true (meaning email notifications are enabled by default for everyone)
ALTER TABLE users ALTER COLUMN online_reminder_enabled SET DEFAULT true;

-- Update existing users to true (to ensure the "default is ON for everyone" requirement holds)
UPDATE users SET online_reminder_enabled = true WHERE online_reminder_enabled IS NULL OR online_reminder_enabled = false;
