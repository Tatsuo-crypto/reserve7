-- Drop the restrictive constraint that requires '予約不可' in title when client_id is null
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS check_blocked_reservation;

-- (Optional) If you want to enforce some rules, you can add a less restrictive constraint,
-- but for now, we'll rely on application logic to handle GUEST and TRIAL types which also have null client_id.
