-- Make client_id nullable to support blocked time reservations
ALTER TABLE reservations ALTER COLUMN client_id DROP NOT NULL;

-- Update the foreign key constraint to allow null values
-- (PostgreSQL foreign keys already allow null by default, so no change needed)

-- Add a check constraint to ensure blocked reservations have proper structure
ALTER TABLE reservations ADD CONSTRAINT check_blocked_reservation 
CHECK (
  (client_id IS NOT NULL) OR 
  (client_id IS NULL AND title LIKE '%予約不可%')
);
