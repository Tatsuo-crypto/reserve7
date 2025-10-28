-- 日次目標チェック記録テーブル
CREATE TABLE IF NOT EXISTS daily_goal_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    monthly_goal_id UUID NOT NULL REFERENCES monthly_goals(id) ON DELETE CASCADE,
    check_date DATE NOT NULL,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, monthly_goal_id, check_date)
);

-- ストリーク（連続記録）管理テーブル
CREATE TABLE IF NOT EXISTS goal_streaks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year INT NOT NULL,
    month INT NOT NULL,
    current_streak INT NOT NULL DEFAULT 0,
    max_streak INT NOT NULL DEFAULT 0,
    last_completed_date DATE,
    total_rewards INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, year, month)
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_daily_goal_checks_user_date ON daily_goal_checks(user_id, check_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_goal_checks_goal ON daily_goal_checks(monthly_goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_streaks_user_year_month ON goal_streaks(user_id, year, month);

-- コメント
COMMENT ON TABLE daily_goal_checks IS '日次の目標達成チェック記録';
COMMENT ON TABLE goal_streaks IS 'ユーザーの連続達成記録（ストリーク）';
COMMENT ON COLUMN goal_streaks.current_streak IS '現在の連続達成日数';
COMMENT ON COLUMN goal_streaks.max_streak IS '最高連続達成日数';
COMMENT ON COLUMN goal_streaks.total_rewards IS '累計獲得報酬';
