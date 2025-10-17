-- Clean up notes from existing trial reservations
-- This removes notes from reservations where title contains '体験'

UPDATE reservations
SET notes = NULL
WHERE title LIKE '%体験%'
  AND notes IS NOT NULL;

-- Verify the update
SELECT id, title, notes, start_time
FROM reservations
WHERE title LIKE '%体験%'
ORDER BY start_time DESC
LIMIT 10;
