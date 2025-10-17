-- Fix check_blocked_reservation constraint to allow trial reservations
-- Drop the old constraint
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS check_blocked_reservation;

-- Add new constraint that allows:
-- 1. Regular reservations (client_id IS NOT NULL)
-- 2. Blocked time reservations (client_id IS NULL AND title contains '予約不可')
-- 3. Trial reservations (client_id IS NULL AND title contains '体験')
ALTER TABLE reservations ADD CONSTRAINT check_blocked_reservation 
CHECK (
  (client_id IS NOT NULL) OR 
  (client_id IS NULL AND (title LIKE '%予約不可%' OR title LIKE '%体験%'))
);
