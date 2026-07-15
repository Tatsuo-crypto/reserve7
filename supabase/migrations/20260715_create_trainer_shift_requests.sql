create table if not exists public.trainer_shift_requests (
  id uuid default gen_random_uuid() primary key,
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'submitted',
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint trainer_shift_requests_valid_time check (end_time > start_time),
  constraint trainer_shift_requests_valid_status check (status in ('submitted', 'approved', 'rejected', 'cancelled'))
);

create index if not exists idx_trainer_shift_requests_trainer_time
  on public.trainer_shift_requests(trainer_id, start_time, end_time);

create index if not exists idx_trainer_shift_requests_status
  on public.trainer_shift_requests(status);
