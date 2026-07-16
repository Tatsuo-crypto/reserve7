create table if not exists public.trainer_shift_template_exceptions (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  template_id uuid references public.trainer_shift_templates(id) on delete cascade,
  work_date date not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trainer_shift_template_exceptions_time_check check (end_time > start_time)
);

create unique index if not exists idx_trainer_shift_template_exceptions_unique
  on public.trainer_shift_template_exceptions(trainer_id, work_date, template_id, start_time, end_time);

create index if not exists idx_trainer_shift_template_exceptions_range
  on public.trainer_shift_template_exceptions(trainer_id, work_date);成功
