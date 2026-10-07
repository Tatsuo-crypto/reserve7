-- Prevent concurrent reservation calendar workers from processing one row twice.
ALTER TABLE reservations
DROP CONSTRAINT IF EXISTS reservations_calendar_sync_status_check;

ALTER TABLE reservations
ADD CONSTRAINT reservations_calendar_sync_status_check
CHECK (calendar_sync_status IN ('pending', 'processing', 'synced', 'failed', 'skipped'));
