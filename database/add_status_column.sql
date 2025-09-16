-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can view their own reservations" ON reservations;

-- RLSを無効化
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE reservations DISABLE ROW LEVEL SECURITY;

-- store_idカラムのみ追加（calendar_idは既に存在するためスキップ）
ALTER TABLE users ADD COLUMN IF NOT EXISTS store_id VARCHAR(50) NOT NULL DEFAULT 'tandjgym@gmail.com';

-- statusカラムを追加（会員管理用）
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

-- statusカラムの制約を追加
ALTER TABLE users ADD CONSTRAINT users_status_check 
CHECK (status IN ('active', 'suspended', 'withdrawn'));

-- statusカラムのインデックスを作成
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- 既存ユーザーのstatusを'active'に設定
UPDATE users 
SET status = 'active' 
WHERE status IS NULL OR status = '';

-- statusカラムにコメントを追加
COMMENT ON COLUMN users.status IS 'Member status: active (在籍), suspended (休会), withdrawn (退会)';

-- 変更を確認
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name IN ('store_id', 'status')
ORDER BY column_name;
