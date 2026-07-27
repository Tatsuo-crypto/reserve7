-- 配信(お知らせ配信)の送信履歴。テンプレート機能は無し(自由記述のみ)。
-- 管理者専用の内部データのためRLSは付けず(既存のtrainer_shift_requests等と同様)APIルート側で権限を制御する。
create table if not exists public.broadcast_messages (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  body text not null,
  important boolean not null default false,
  target_count int not null default 0,
  success_count int not null default 0,
  sent_by text,
  created_at timestamptz default now()
);

create index if not exists idx_broadcast_messages_created_at on public.broadcast_messages(created_at desc);
