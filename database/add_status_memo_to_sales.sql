-- Add status and memo columns to sales table
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS status text DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid'));
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS memo text;
