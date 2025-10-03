-- RPC: members_count_by_store
-- Returns member counts per store, excluding admin accounts
-- Optional filter: store_ids uuid[]
create or replace function public.members_count_by_store(store_ids uuid[] default null)
returns table(store_id uuid, member_count integer) as $$
  select u.store_id, count(*)::int as member_count
  from public.users u
  where (store_ids is null or u.store_id = any(store_ids))
    and u.email not in ('tandjgym@gmail.com','tandjgym2goutenn@gmail.com')
  group by u.store_id;
$$ language sql stable;
