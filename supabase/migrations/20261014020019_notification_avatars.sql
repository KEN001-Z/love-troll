begin;

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

notify pgrst, 'reload schema';
commit;