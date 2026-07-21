-- T-5 / AB-優先1: 利用規約・プライバシーポリシーへの同意記録
-- subject_type + subject_id で users/trainers/adminの3種を横断的に扱う(FK制約は張らない。
-- テーブルをまたぐ参照になるため、整合性はアプリ側のtoken検証に委ねる)。
CREATE TABLE IF NOT EXISTS consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('member', 'trainer_staff', 'admin')),
  subject_id TEXT NOT NULL,
  terms_version TEXT NOT NULL,
  privacy_version TEXT NOT NULL,
  agreed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 同一subjectが同一バージョンに複数回同意しても1行に収まるよう、
-- (subject_type, subject_id, terms_version, privacy_version) の組で重複を防ぐ。
CREATE UNIQUE INDEX IF NOT EXISTS idx_consent_records_subject_version
ON consent_records(subject_type, subject_id, terms_version, privacy_version);

CREATE INDEX IF NOT EXISTS idx_consent_records_subject
ON consent_records(subject_type, subject_id);

-- データエクスポート/削除リクエストの記録(即時自動化ではなく、管理者が対応するためのキュー)
CREATE TABLE IF NOT EXISTS data_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('member', 'trainer_staff')),
  subject_id TEXT NOT NULL,
  subject_name TEXT,
  subject_email TEXT,
  request_type TEXT NOT NULL CHECK (request_type IN ('export', 'delete')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')),
  note TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_requests_status
ON data_requests(status, requested_at);
