begin;

create table public.notifications (
  id bigint generated always as identity primary key,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('follow', 'interest', 'match')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint notifications_no_self check (recipient_id <> actor_id)
);

create index notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;

create policy "Users can read their own notifications"
  on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));

create or replace function private.notify_new_follow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (recipient_id, actor_id, kind)
  values (new.following_id, new.follower_id, 'follow');
  return new;
end;
$$;

revoke all on function private.notify_new_follow() from public, anon, authenticated;

create trigger follows_notify_new_follow
after insert on public.follows
for each row execute function private.notify_new_follow();

create or replace function private.notify_new_interest()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.discovery_likes existing_interest
    where existing_interest.user_id = new.target_id
      and existing_interest.target_id = new.user_id
  ) then
    update public.notifications
    set kind = 'match', created_at = pg_catalog.now(), read_at = null
    where recipient_id = new.user_id
      and actor_id = new.target_id
      and kind = 'interest';

    insert into public.notifications (recipient_id, actor_id, kind)
    values (new.target_id, new.user_id, 'match');
  else
    insert into public.notifications (recipient_id, actor_id, kind)
    values (new.target_id, new.user_id, 'interest');
  end if;
  return new;
end;
$$;

revoke all on function private.notify_new_interest() from public, anon, authenticated;

create trigger discovery_likes_notify_new_interest
after insert on public.discovery_likes
for each row execute function private.notify_new_interest();

create or replace function public.get_my_notifications()
returns table (
  notification_id bigint,
  actor_id uuid,
  actor_display_name text,
  actor_username text,
  actor_avatar_path text,
  kind text,
  created_at timestamptz,
  read_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'You must be signed in to view notifications.';
  end if;

  return query
  select n.id, p.id, p.display_name, p.username, p.avatar_path, n.kind, n.created_at, n.read_at
  from public.notifications n
  join public.profiles p on p.id = n.actor_id
  where n.recipient_id = actor
  order by n.created_at desc, n.id desc
  limit 50;
end;
$$;

revoke all on function public.get_my_notifications() from public, anon;
grant execute on function public.get_my_notifications() to authenticated;

create or replace function public.mark_my_notifications_read()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'You must be signed in to update notifications.';
  end if;

  update public.notifications
  set read_at = pg_catalog.now()
  where recipient_id = actor and read_at is null;
end;
$$;

revoke all on function public.mark_my_notifications_read() from public, anon;
grant execute on function public.mark_my_notifications_read() to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;