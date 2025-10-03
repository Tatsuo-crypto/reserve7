-- Migration: add email column to stores (nullable, unique)
alter table if exists public.stores
  add column if not exists email text;

create unique index if not exists uq_stores_email on public.stores(email) where email is not null;

-- Update policies unchanged.
