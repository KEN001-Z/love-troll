begin;

alter table public.notifications
  drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('follow', 'interest', 'match', 'message', 'like'));
alter table public.notifications
  add column post_id uuid references public.posts (id) on delete cascade;

create index notifications_post_id_idx
  on public.notifications (post_id)
  where post_id is not null;

alter table public.push_notification_outbox
  drop constraint if exists push_notification_outbox_kind_check;
alter table public.push_notification_outbox
  add constraint push_notification_outbox_kind_check
  check (kind in ('follow', 'interest', 'match', 'message', 'like'));

create or replace function private.notify_new_post_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  post_owner uuid;
begin
  select post.author_id
  into post_owner
  from public.posts post
  where post.id = new.post_id
    and post.moderation_status = 'published';

  if post_owner is null or post_owner = new.user_id then
    return new;
  end if;

  if exists (
    select 1
    from public.profile_blocks profile_block
    where (profile_block.blocker_id = post_owner and profile_block.blocked_id = new.user_id)
       or (profile_block.blocker_id = new.user_id and profile_block.blocked_id = post_owner)
  ) then
    return new;
  end if;

  insert into public.notifications (recipient_id, actor_id, kind, post_id)
  values (post_owner, new.user_id, 'like', new.post_id);

  return new;
end;
$$;

revoke all on function private.notify_new_post_like() from public, anon, authenticated;

create trigger post_likes_notify_owner
after insert on public.post_likes
for each row execute function private.notify_new_post_like();

drop function public.get_my_notifications();

create function public.get_my_notifications()
returns table (
  notification_id bigint,
  actor_id uuid,
  actor_display_name text,
  actor_username text,
  actor_avatar_path text,
  kind text,
  created_at timestamptz,
  read_at timestamptz,
  conversation_id uuid,
  post_id uuid,
  post_type text
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
  select n.id, p.id, p.display_name, p.username, p.avatar_path, n.kind,
         n.created_at, n.read_at, n.conversation_id, n.post_id, post.post_type
  from public.notifications n
  join public.profiles p on p.id = n.actor_id
  left join public.posts post on post.id = n.post_id
  where n.recipient_id = actor
  order by n.created_at desc, n.id desc
  limit 50;
end;
$$;

revoke all on function public.get_my_notifications() from public, anon;
grant execute on function public.get_my_notifications() to authenticated;

notify pgrst, 'reload schema';
commit;