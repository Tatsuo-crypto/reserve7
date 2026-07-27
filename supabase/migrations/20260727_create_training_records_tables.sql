-- トレーニングカルテ機能: セッション(来店1回分)/種目カード/セット記録 + 種目マスタ
-- トレーナー・管理者のみが入出力する内部データのため、RLSは付けず(既存のtrainer_shift_requests等と
-- 同様)APIルート側(トレーナートークン or 管理者セッション)で権限を制御する。

create table if not exists public.exercise_master (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.training_sessions (
  id uuid default gen_random_uuid() primary key,
  reservation_id uuid references public.reservations(id) on delete set null,
  user_id uuid not null references public.users(id) on delete cascade,
  trainer_id uuid references public.trainers(id) on delete set null,
  session_date date not null default current_date,
  session_type text,
  approach text,
  overall_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.training_exercises (
  id uuid default gen_random_uuid() primary key,
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  exercise_name text not null,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.training_sets (
  id uuid default gen_random_uuid() primary key,
  exercise_id uuid not null references public.training_exercises(id) on delete cascade,
  set_number int not null default 1,
  weight numeric(10,2),
  reps int,
  assisted boolean not null default false,
  memo text,
  created_at timestamptz default now()
);

create index if not exists idx_training_sessions_user_id on public.training_sessions(user_id, session_date desc);
create index if not exists idx_training_sessions_reservation_id on public.training_sessions(reservation_id);
create unique index if not exists idx_training_sessions_reservation_unique on public.training_sessions(reservation_id) where reservation_id is not null;
create index if not exists idx_training_exercises_session_id on public.training_exercises(session_id);
create index if not exists idx_training_sets_exercise_id on public.training_sets(exercise_id);

insert into public.exercise_master (name, sort_order) values
  ('ASRL', 1),
  ('大腿筋膜張筋', 2),
  ('中臀筋', 3),
  ('VSランジ回し', 4),
  ('HL', 5),
  ('ゴブレット', 6),
  ('WUP', 7),
  ('SSQ', 8),
  ('SIBP', 9),
  ('オーバーヘッドプレス', 10),
  ('クリーン&プッシュ', 11)
on conflict (name) do nothing;
