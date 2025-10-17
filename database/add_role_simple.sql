-- シンプルなrole追加のみ

-- roleカラムを追加
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'CLIENT' 
CHECK (role IN ('ADMIN', 'STAFF', 'CLIENT'));

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 既存の管理者をADMINに設定
UPDATE users 
SET role = 'ADMIN' 
WHERE email IN ('tandjgym@gmail.com', 'tandjgym2goutenn@gmail.com');

-- access_token がない場合は追加（既にあればスキップ）
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS access_token UUID DEFAULT uuid_generate_v4();

CREATE INDEX IF NOT EXISTS idx_users_access_token ON users(access_token);

COMMENT ON COLUMN users.role IS 'ADMIN: 管理者（ログイン）, STAFF: アルバイト（トークンURL）, CLIENT: 会員（トークンURL）';
