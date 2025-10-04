-- Count by users.store_id; compare as text to avoid type mismatch
create or replace function public.members_count_by_store(store_ids text[] default null)
returns table(store_id text, member_count integer) as $$
  select u.store_id::text as store_id, count(*)::int as member_count
  from public.users u
  where (store_ids is null or u.store_id::text = any(store_ids))
    and u.email not in ('tandjgym@gmail.com','tandjgym2goutenn@gmail.com')
  group by u.store_id::text;
$$ language sql stable;
