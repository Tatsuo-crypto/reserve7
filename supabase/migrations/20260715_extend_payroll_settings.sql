-- Extend payroll settings with break rules and attendance confirmation.

alter table public.trainers
  add column if not exists break_rule_threshold_minutes integer not null default 480 check (break_rule_threshold_minutes >= 0),
  add column if not exists break_rule_minutes integer not null default 120 check (break_rule_minutes >= 0);

alter table public.trainer_attendance_records
  add column if not exists attended boolean not null default false;
