ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS billing_start_month date;