-- Create membership_history table to track status changes over time
create table if not exists public.membership_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid references public.stores(id), -- Snapshot of store at that time
  status text not null check (status in ('active', 'suspended', 'withdrawn')),
  start_date date not null,
  end_date date, -- null means current/active
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Constraints
  constraint membership_history_date_check check (end_date is null or end_date >= start_date)
);

-- RLS for membership_history
alter table public.membership_history enable row level security;

create policy membership_history_select_admin on public.membership_history
  for select using (auth.jwt() ->> 'role' = 'ADMIN');

create policy membership_history_all_admin on public.membership_history
  for all using (auth.jwt() ->> 'role' = 'ADMIN');

create policy membership_history_read_own on public.membership_history
  for select using (auth.uid() = user_id);

-- Create sales table for tracking monthly fees
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete set null, -- Keep sales record even if user is deleted? Maybe.
  store_id uuid references public.stores(id),
  amount integer not null,
  type text not null default 'monthly_fee', -- 'monthly_fee', 'ticket', 'setup_fee', etc.
  target_date date not null, -- The month this fee is for (e.g. 2024-01-01)
  payment_date date, -- Specific payment date if available
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index idx_membership_history_user on public.membership_history(user_id);
create index idx_membership_history_period on public.membership_history(start_date, end_date);
create index idx_sales_user on public.sales(user_id);
create index idx_sales_target_date on public.sales(target_date);
create index idx_sales_type on public.sales(type);

-- RLS for sales
alter table public.sales enable row level security;

create policy sales_select_admin on public.sales
  for select using (auth.jwt() ->> 'role' = 'ADMIN');

create policy sales_all_admin on public.sales
  for all using (auth.jwt() ->> 'role' = 'ADMIN');
