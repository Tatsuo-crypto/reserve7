-- Payroll settings and monthly attendance for part-time staff.

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

alter table public.trainers
  add column if not exists payroll_enabled boolean not null default false,
  add column if not exists daily_transportation_cost integer not null default 0;

create table if not exists public.trainer_pay_rates (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  hourly_wage integer not null check (hourly_wage >= 0),
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trainer_pay_rates_valid_range check (effective_to is null or effective_to >= effective_from)
);

create table if not exists public.trainer_attendance_records (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  shift_id uuid references public.trainer_shifts(id) on delete set null,
  work_date date not null,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  clock_in timestamptz not null,
  clock_out timestamptz not null,
  break_minutes integer not null default 0 check (break_minutes >= 0),
  transportation_enabled boolean not null default true,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trainer_attendance_valid_time check (clock_out > clock_in)
);

create table if not exists public.trainer_payroll_months (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  payroll_month date not null,
  allowance_amount integer not null default 0,
  adjustment_amount integer not null default 0,
  memo text,
  status text not null default 'draft' check (status in ('draft', 'confirmed')),
  confirmed_at timestamptz,
  confirmed_total_amount integer,
  changed_after_confirm boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trainer_id, payroll_month)
);

create unique index if not exists idx_trainer_attendance_shift_unique
  on public.trainer_attendance_records(shift_id)
  where shift_id is not null;

create index if not exists idx_trainers_payroll_enabled
  on public.trainers(payroll_enabled);
create index if not exists idx_trainer_pay_rates_trainer_date
  on public.trainer_pay_rates(trainer_id, effective_from);
create index if not exists idx_trainer_attendance_trainer_date
  on public.trainer_attendance_records(trainer_id, work_date);
create index if not exists idx_trainer_payroll_months_trainer_month
  on public.trainer_payroll_months(trainer_id, payroll_month);

drop trigger if exists trainer_pay_rates_set_updated_at on public.trainer_pay_rates;
create trigger trainer_pay_rates_set_updated_at
before update on public.trainer_pay_rates
for each row execute function public.set_updated_at();

drop trigger if exists trainer_attendance_records_set_updated_at on public.trainer_attendance_records;
create trigger trainer_attendance_records_set_updated_at
before update on public.trainer_attendance_records
for each row execute function public.set_updated_at();

drop trigger if exists trainer_payroll_months_set_updated_at on public.trainer_payroll_months;
create trigger trainer_payroll_months_set_updated_at
before update on public.trainer_payroll_months
for each row execute function public.set_updated_at();

alter table public.trainer_pay_rates enable row level security;
alter table public.trainer_attendance_records enable row level security;
alter table public.trainer_payroll_months enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'trainer_pay_rates'
      and policyname = 'trainer_pay_rates_admin_all'
  ) then
    create policy trainer_pay_rates_admin_all on public.trainer_pay_rates
      for all using (auth.jwt() ->> 'role' = 'ADMIN')
      with check (auth.jwt() ->> 'role' = 'ADMIN');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'trainer_attendance_records'
      and policyname = 'trainer_attendance_records_admin_all'
  ) then
    create policy trainer_attendance_records_admin_all on public.trainer_attendance_records
      for all using (auth.jwt() ->> 'role' = 'ADMIN')
      with check (auth.jwt() ->> 'role' = 'ADMIN');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'trainer_payroll_months'
      and policyname = 'trainer_payroll_months_admin_all'
  ) then
    create policy trainer_payroll_months_admin_all on public.trainer_payroll_months
      for all using (auth.jwt() ->> 'role' = 'ADMIN')
      with check (auth.jwt() ->> 'role' = 'ADMIN');
  end if;
end $$;
