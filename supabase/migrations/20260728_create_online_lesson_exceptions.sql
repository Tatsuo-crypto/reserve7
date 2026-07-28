-- AP-1: オンラインレッスンの「その日だけ休講」を持たせるテーブル。
-- online_lessonsは「毎週◯曜」という繰り返し設定しか持たないため、今週だけ休みにしたい場合に
-- 曜日設定そのものを書き換えるしかなく、翌週以降まで巻き込んでしまう問題があった。
-- 例外日をこのテーブルに1行入れることで、その日だけ開催なし(自動リマインダーも送らない)にする。
-- 管理者専用の内部データのためRLSは付けず(既存のtrainer_shift_requests等と同様)APIルート側で権限を制御する。
create table if not exists public.online_lesson_exceptions (
  id uuid default gen_random_uuid() primary key,
  online_lesson_id uuid not null references public.online_lessons(id) on delete cascade,
  exception_date date not null,
  reason text,
  created_at timestamptz default now(),
  unique (online_lesson_id, exception_date)
);

create index if not exists idx_online_lesson_exceptions_lesson_date
  on public.online_lesson_exceptions(online_lesson_id, exception_date);
