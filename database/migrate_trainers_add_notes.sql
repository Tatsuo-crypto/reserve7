-- Add notes column to trainers table if missing
alter table public.trainers
  add column if not exists notes text;
