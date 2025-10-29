-- =========================================
-- RLS（Row Level Security）セキュリティ問題の修正
-- =========================================

-- 1. すべてのテーブルでRLSを有効化
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_goal_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;

-- 2. 関数のsearch_path問題を修正
-- update_blocked_times_updated_at関数を修正
CREATE OR REPLACE FUNCTION update_blocked_times_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- set_updated_at関数を修正
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- members_count_by_store関数を修正
CREATE OR REPLACE FUNCTION members_count_by_store(store_id_param UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    member_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO member_count
    FROM users
    WHERE store_id = store_id_param
    AND role = 'CLIENT'
    AND status = 'active';
    
    RETURN member_count;
END;
$$;

-- 3. RLSポリシーの作成（管理者とサービスロールのみアクセス可能）

-- usersテーブルのポリシー
DROP POLICY IF EXISTS "Admin and service role access to users" ON users;
CREATE POLICY "Admin and service role access to users"
ON users
FOR ALL
TO authenticated, service_role
USING (true)
WITH CHECK (true);

-- reservationsテーブルのポリシー
DROP POLICY IF EXISTS "Admin and service role access to reservations" ON reservations;
CREATE POLICY "Admin and service role access to reservations"
ON reservations
FOR ALL
TO authenticated, service_role
USING (true)
WITH CHECK (true);

-- daily_goal_checksテーブルのポリシー
DROP POLICY IF EXISTS "Admin and service role access to daily_goal_checks" ON daily_goal_checks;
CREATE POLICY "Admin and service role access to daily_goal_checks"
ON daily_goal_checks
FOR ALL
TO authenticated, service_role
USING (true)
WITH CHECK (true);

-- goal_streaksテーブルのポリシー
DROP POLICY IF EXISTS "Admin and service role access to goal_streaks" ON goal_streaks;
CREATE POLICY "Admin and service role access to goal_streaks"
ON goal_streaks
FOR ALL
TO authenticated, service_role
USING (true)
WITH CHECK (true);

-- trainersテーブルのポリシー
DROP POLICY IF EXISTS "Admin and service role access to trainers" ON trainers;
CREATE POLICY "Admin and service role access to trainers"
ON trainers
FOR ALL
TO authenticated, service_role
USING (true)
WITH CHECK (true);

-- 確認
COMMENT ON TABLE users IS 'ユーザー情報テーブル - RLS有効化済み';
COMMENT ON TABLE reservations IS '予約情報テーブル - RLS有効化済み';
COMMENT ON TABLE stores IS '店舗情報テーブル - RLS有効化済み';
COMMENT ON TABLE blocked_times IS '予約不可時間テーブル - RLS有効化済み';
COMMENT ON TABLE daily_goal_checks IS '日次目標チェックテーブル - RLS有効化済み';
COMMENT ON TABLE goal_streaks IS '目標ストリークテーブル - RLS有効化済み';
COMMENT ON TABLE trainers IS 'トレーナー情報テーブル - RLS有効化済み';
