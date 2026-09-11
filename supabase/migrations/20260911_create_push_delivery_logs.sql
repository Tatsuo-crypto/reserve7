-- Store the actual Web Push delivery attempt result.
-- user_notifications is the in-app inbox history; it can exist even when a device push
-- cannot be sent. This table is for diagnosing real device delivery.
create table if not exists public.push_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  subscription_id uuid null,
  endpoint_hash text,
  title text not null,
  category text not null default 'other',
  url text,
  success boolean not null default false,
  status text not null,
  status_code integer,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_delivery_logs_user_created
  on public.push_delivery_logs(user_id, created_at desc);

create index if not exists idx_push_delivery_logs_created
  on public.push_delivery_logs(created_at desc);

create index if not exists idx_push_delivery_logs_status_created
  on public.push_delivery_logs(status, created_at desc);
