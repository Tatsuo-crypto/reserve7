-- AX-1: 会員がアプリ内で通知を読み返せるようにするための履歴。
-- これまでプッシュ通知は送りっぱなしで、会員が通知を消してしまうと内容を確認する手段が無かった。
-- sendPushNotificationToUser() を通る通知はすべてここに記録する(配信のお知らせ、
-- 予約前日リマインダー、オンラインレッスンの通知など)。
-- 端末側の購読が無く実際には届かなかった場合でも記録は残す(アプリを開けば読めるようにするため)。
-- 会員専用の内部データだが、アクセスは常にサーバー側(service role)経由のため、
-- 既存方針に合わせてRLSは付けずAPIルート側で会員トークンを検証する。
create table if not exists public.user_notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  body text not null,
  -- 通知タップ時の遷移先(会員画面の相対パス)
  url text,
  -- broadcast(配信のお知らせ) / reservation(予約リマインダー) / online_lesson(レッスン通知) など
  category text not null default 'other',
  read_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_user_notifications_user_created
  on public.user_notifications(user_id, created_at desc);

create index if not exists idx_user_notifications_unread
  on public.user_notifications(user_id) where read_at is null;
