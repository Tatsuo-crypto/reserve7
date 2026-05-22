-- Create junction table to map users (members) to online lessons
CREATE TABLE IF NOT EXISTS online_lesson_users (
    online_lesson_id UUID NOT NULL REFERENCES online_lessons(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (online_lesson_id, user_id)
);
