-- 会員・トレーナー・管理者向けの共有資料。
-- ファイル本体はSupabase Storage、DBには一覧表示と対象判定に必要な情報だけを保存する。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shared-materials',
  'shared-materials',
  false,
  52428800,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create table if not exists public.shared_materials (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  material_type text not null check (material_type in ('pdf', 'image', 'video', 'link')),
  external_url text,
  storage_bucket text not null default 'shared-materials',
  storage_path text,
  is_published boolean not null default false,
  publish_start_at timestamptz,
  publish_end_at timestamptz,
  display_order int not null default 0,
  target_groups text[] not null default '{}',
  target_user_ids uuid[] not null default '{}',
  target_trainer_ids uuid[] not null default '{}',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shared_materials_has_target check (
    coalesce(array_length(target_groups, 1), 0) > 0
    or coalesce(array_length(target_user_ids, 1), 0) > 0
    or coalesce(array_length(target_trainer_ids, 1), 0) > 0
  ),
  constraint shared_materials_has_source check (
    nullif(external_url, '') is not null
    or nullif(storage_path, '') is not null
  )
);

create index if not exists idx_shared_materials_public
  on public.shared_materials(is_published, display_order, created_at desc);

create index if not exists idx_shared_materials_target_groups
  on public.shared_materials using gin(target_groups);

create index if not exists idx_shared_materials_target_user_ids
  on public.shared_materials using gin(target_user_ids);

create index if not exists idx_shared_materials_target_trainer_ids
  on public.shared_materials using gin(target_trainer_ids);
