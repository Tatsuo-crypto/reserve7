-- Store the trainer's actual check-in time separately from scheduled payroll times.
alter table public.trainer_attendance_records
  add column if not exists checked_in_at timestamptz;

create index if not exists idx_trainer_attendance_checked_in_at
  on public.trainer_attendance_records(checked_in_at);
