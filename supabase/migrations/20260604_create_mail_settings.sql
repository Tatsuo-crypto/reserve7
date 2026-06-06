-- Create mail_settings table to store global email notification preferences
CREATE TABLE IF NOT EXISTS mail_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  reminder_before_minutes INTEGER DEFAULT 30,
  sender_display_name TEXT DEFAULT 'T&J GYM',
  additional_recipient_emails TEXT DEFAULT '', -- Comma-separated list of additional emails
  client_create_notify BOOLEAN DEFAULT true,
  client_update_notify BOOLEAN DEFAULT true,
  client_cancel_notify BOOLEAN DEFAULT true,
  trainer_create_notify BOOLEAN DEFAULT true,
  trainer_update_notify BOOLEAN DEFAULT true,
  trainer_cancel_notify BOOLEAN DEFAULT true,
  personal_reminder_enabled BOOLEAN DEFAULT true,
  personal_reminder_days_before INTEGER DEFAULT 1,
  personal_reminder_hour INTEGER DEFAULT 9,
  personal_reminder_template TEXT DEFAULT 'ご予約のセッション日時が近づいてまいりましたので、お知らせいたします。
内容をご確認いただき、お気をつけてお越しください。',
  online_announcement_template TEXT DEFAULT 'オンラインレッスンが開催されますので、お知らせいたします。
お時間になりましたら、以下のリンクよりご参加ください。

レッスン：{title}
開始時間：{time}
URL：{url}',
  client_create_template TEXT DEFAULT 'ご予約が確定しました。',
  client_update_template TEXT DEFAULT 'ご予約内容が変更されましたのでご確認ください。',
  client_cancel_template TEXT DEFAULT 'ご予約のキャンセルを承りました。',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add new columns dynamically if the table already existed
ALTER TABLE mail_settings ADD COLUMN IF NOT EXISTS personal_reminder_enabled BOOLEAN DEFAULT true;
ALTER TABLE mail_settings ADD COLUMN IF NOT EXISTS personal_reminder_days_before INTEGER DEFAULT 1;
ALTER TABLE mail_settings ADD COLUMN IF NOT EXISTS personal_reminder_hour INTEGER DEFAULT 9;
ALTER TABLE mail_settings ADD COLUMN IF NOT EXISTS personal_reminder_template TEXT DEFAULT 'ご予約のセッション日時が近づいてまいりましたので、お知らせいたします。
内容をご確認いただき、お気をつけてお越しください。';
ALTER TABLE mail_settings ADD COLUMN IF NOT EXISTS online_announcement_template TEXT DEFAULT 'オンラインレッスンが開催されますので、お知らせいたします。
お時間になりましたら、以下のリンクよりご参加ください。

レッスン：{title}
開始時間：{time}
URL：{url}';
ALTER TABLE mail_settings ADD COLUMN IF NOT EXISTS client_create_template TEXT DEFAULT 'ご予約が確定しました。';
ALTER TABLE mail_settings ADD COLUMN IF NOT EXISTS client_update_template TEXT DEFAULT 'ご予約内容が変更されましたのでご確認ください。';
ALTER TABLE mail_settings ADD COLUMN IF NOT EXISTS client_cancel_template TEXT DEFAULT 'ご予約のキャンセルを承りました。';

-- Insert default settings row
INSERT INTO mail_settings (id) VALUES ('global') ON CONFLICT DO NOTHING;


-- Create reservation_reminders table to track sent personal session reminders and prevent duplicates
CREATE TABLE IF NOT EXISTS reservation_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  sent_date DATE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add a unique constraint to prevent sending multiple reminders for the same reservation on the same day
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservation_reminders_unique ON reservation_reminders (reservation_id, sent_date);
