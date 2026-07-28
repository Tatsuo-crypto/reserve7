-- AP-3: 「その日だけ休講」に加えて「別の日に振替」も持てるようにする。
-- moved_to_date が NULL のまま = 休講(その日は開催なし)。
-- moved_to_date が入っている = 振替(元の日は開催なし、代わりにその日時に開催)。
-- 振替先の時刻を省略した場合は、元のレッスンの開始・終了時刻をそのまま使う。
alter table public.online_lesson_exceptions
  add column if not exists moved_to_date date,
  add column if not exists moved_to_start_time time,
  add column if not exists moved_to_end_time time;

create index if not exists idx_online_lesson_exceptions_moved_to_date
  on public.online_lesson_exceptions(moved_to_date);
