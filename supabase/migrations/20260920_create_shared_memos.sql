-- 会員と共有する短いメモ。管理用のusers.memoとは分ける。
create extension if not exists "uuid-ossp";

create table if not exists public.shared_memos (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  is_published boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_shared_memos_user_created
  on public.shared_memos(user_id, is_published, created_at desc);
