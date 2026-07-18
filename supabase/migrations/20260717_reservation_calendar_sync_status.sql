ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS calendar_sync_status TEXT NOT NULL DEFAULT 'synced'
  CHECK (calendar_sync_status IN ('pending', 'synced', 'failed', 'skipped')),
ADD COLUMN IF NOT EXISTS calendar_sync_action TEXT,
ADD COLUMN IF NOT EXISTS calendar_sync_error TEXT,
ADD COLUMN IF NOT EXISTS calendar_sync_attempted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS calendar_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_reservations_calendar_sync_status
ON reservations(calendar_sync_status, start_time);

