-- M-1: 成果ゴール（体重・習慣）を管理する統一テーブル。
-- diet_goals（カロリー・PFC・生活習慣＝手段の設定）とはライフサイクルが異なるため、
-- 期限・達成判定を持つ別テーブルとして新設する。

CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('weight', 'habit')),
  title TEXT NOT NULL,
  -- 体重ゴールのみ使用（kg）。習慣ゴールはNULL。
  target_value NUMERIC(10, 2),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- 任意。習慣ゴールは期限なし（継続チャレンジ）も許容する。
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'missed', 'archived')),
  achieved_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id_status ON goals(user_id, status);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their own goals" ON goals
  FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "Users can manage their own goals" ON goals
  FOR ALL USING (auth.uid() = user_id OR is_admin());

-- 既存のusers.target_weight_kgを、各会員の最初の体重ゴール（期限なし・active）として移行する。
INSERT INTO goals (user_id, type, title, target_value, start_date, status)
SELECT id, 'weight', '目標体重', target_weight_kg, CURRENT_DATE, 'active'
FROM users
WHERE target_weight_kg IS NOT NULL;

-- users.target_weight_kgは廃止方向。移行完了後、本カラムは会員編集画面の入力欄撤去とあわせて
-- 別途DROP COLUMNする（既存コードの参照が完全になくなったことを確認してから実行すること）。
