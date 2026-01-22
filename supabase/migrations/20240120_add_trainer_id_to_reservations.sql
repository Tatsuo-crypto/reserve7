-- Add trainer_id column to reservations table
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS trainer_id UUID REFERENCES trainers(id);

-- Optional: Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_reservations_trainer_id ON reservations(trainer_id);
