CREATE TABLE IF NOT EXISTS reservation_calendar_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL CHECK (action IN ('delete')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'synced', 'failed', 'skipped')),
  payload JSONB NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  attempted_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservation_calendar_sync_jobs_status
ON reservation_calendar_sync_jobs(status, created_at);

