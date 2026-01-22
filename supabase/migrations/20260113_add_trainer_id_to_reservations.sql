
-- Add trainer_id to reservations table
ALTER TABLE public.reservations 
ADD COLUMN trainer_id UUID REFERENCES public.trainers(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX idx_reservations_trainer_id ON public.reservations(trainer_id);
