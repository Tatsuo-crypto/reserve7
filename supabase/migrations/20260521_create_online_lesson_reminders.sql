-- Create online_lesson_reminders table to track sent reminder emails and prevent duplicates
CREATE TABLE IF NOT EXISTS online_lesson_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    online_lesson_id UUID NOT NULL REFERENCES online_lessons(id) ON DELETE CASCADE,
    sent_date DATE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add a unique constraint to prevent sending multiple reminders for the same lesson on the same day
CREATE UNIQUE INDEX IF NOT EXISTS idx_online_lesson_reminders_unique ON online_lesson_reminders (online_lesson_id, sent_date);
