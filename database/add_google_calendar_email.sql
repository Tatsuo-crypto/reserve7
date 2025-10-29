-- =========================================
-- Googleカレンダー連携機能の追加
-- =========================================

-- usersテーブルにGoogleカレンダー連携用のメールアドレスカラムを追加
ALTER TABLE users
ADD COLUMN IF NOT EXISTS google_calendar_email TEXT;

COMMENT ON COLUMN users.google_calendar_email IS '会員のGoogleカレンダー連携用メールアドレス（予約を会員のカレンダーにも追加する）';
