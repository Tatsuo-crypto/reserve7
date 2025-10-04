-- Trainers table for T&J GYM
-- Run this in Supabase SQL editor

create table if not exists public.trainers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text unique not null,
  store_id uuid not null,
  status text not null default 'active', -- active | inactive
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Updated at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trainers_set_updated_at
before update on public.trainers
for each row execute function public.set_updated_at();

-- Indexes
create index if not exists idx_trainers_store_id on public.trainers(store_id);
create index if not exists idx_trainers_status on public.trainers(status);
create index if not exists idx_trainers_email on public.trainers(email);

-- RLS
alter table public.trainers enable row level security;

-- Allow admins to do everything. We assume admin users are in auth.users and mapped via a custom claim in app logic.
-- For Supabase RLS, we rely on JWT claim 'role' = 'ADMIN'
create policy if not exists trainers_select_admin on public.trainers
  for select using (auth.jwt() ->> 'role' = 'ADMIN');

create policy if not exists trainers_insert_admin on public.trainers
  for insert with check (auth.jwt() ->> 'role' = 'ADMIN');

create policy if not exists trainers_update_admin on public.trainers
  for update using (auth.jwt() ->> 'role' = 'ADMIN');

create policy if not exists trainers_delete_admin on public.trainers
  for delete using (auth.jwt() ->> 'role' = 'ADMIN');
