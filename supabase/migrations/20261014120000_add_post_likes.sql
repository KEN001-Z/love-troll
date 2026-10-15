-- Post likes for the VYBE feed.
-- Likes are stored per (post, user). Browser roles have no direct table access:
-- all reads and writes go through the two security-definer functions below,
-- which derive the actor from auth.uid() and only expose counts and the
-- caller's own like state (never who liked a post).

create table if not exists public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_likes_user_created_idx
  on public.post_likes (user_id, created_at desc);

alter table public.post_likes enable row level security;
revoke all on public.post_likes from public, anon, authenticated;

create or replace function public.get_post_like_state(p_post_ids uuid[])
returns table (post_id uuid, like_count bigint, liked_by_me boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or not exists (
    select 1 from public.profiles viewer
    where viewer.id = actor and viewer.onboarding_completed
  ) then
    raise exception 'Complete onboarding to see likes.' using errcode = '42501';
  end if;

  if coalesce(array_length(p_post_ids, 1), 0) > 100 then
    raise exception 'Too many posts requested.' using errcode = '22023';
  end if;

  return query
  select
    p.id,
    (select count(*) from public.post_likes pl where pl.post_id = p.id),
    exists (
      select 1 from public.post_likes pl
      where pl.post_id = p.id and pl.user_id = actor
    )
  from public.posts p
  where p.id = any (p_post_ids)
    and p.moderation_status = 'published';
end;
$$;

create or replace function public.set_post_like(p_post_id uuid, p_liked boolean)
returns table (liked boolean, like_count bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or not exists (
    select 1 from public.profiles viewer
    where viewer.id = actor and viewer.onboarding_completed
  ) then
    raise exception 'Complete onboarding to like posts.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.posts p
    where p.id = p_post_id and p.moderation_status = 'published'
  ) then
    raise exception 'This post is no longer available.' using errcode = 'P0002';
  end if;

  if p_liked then
    insert into public.post_likes (post_id, user_id)
    values (p_post_id, actor)
    on conflict do nothing;
  else
    delete from public.post_likes pl
    where pl.post_id = p_post_id and pl.user_id = actor;
  end if;

  return query
  select
    p_liked,
    (select count(*) from public.post_likes pl where pl.post_id = p_post_id);
end;
$$;

revoke all on function public.get_post_like_state(uuid[]) from public, anon;
revoke all on function public.set_post_like(uuid, boolean) from public, anon;
grant execute on function public.get_post_like_state(uuid[]) to authenticated;
grant execute on function public.set_post_like(uuid, boolean) to authenticated;
