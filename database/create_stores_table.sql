-- Stores table for T&J GYM
-- Run this in Supabase SQL editor

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  calendar_id text not null, -- Google Calendar ID used for this store
  status text not null default 'active', -- active | inactive
  address text,
  phone text,
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

create trigger stores_set_updated_at
before update on public.stores
for each row execute function public.set_updated_at();

-- Indexes
create index if not exists idx_stores_status on public.stores(status);
create index if not exists idx_stores_name on public.stores(name);

-- RLS
alter table public.stores enable row level security;

-- Admin policies
create policy if not exists stores_select_admin on public.stores
  for select using (auth.jwt() ->> 'role' = 'ADMIN');

create policy if not exists stores_insert_admin on public.stores
  for insert with check (auth.jwt() ->> 'role' = 'ADMIN');

create policy if not exists stores_update_admin on public.stores
  for update using (auth.jwt() ->> 'role' = 'ADMIN');

create policy if not exists stores_delete_admin on public.stores
  for delete using (auth.jwt() ->> 'role' = 'ADMIN');
