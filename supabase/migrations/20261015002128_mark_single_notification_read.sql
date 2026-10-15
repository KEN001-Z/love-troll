begin;

create or replace function public.mark_my_notification_read(p_notification_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  updated_count integer;
begin
  if actor is null then
    raise exception 'You must be signed in to update notifications.';
  end if;

  update public.notifications
  set read_at = pg_catalog.now()
  where id = p_notification_id
    and recipient_id = actor
    and read_at is null;

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

revoke all on function public.mark_my_notification_read(bigint) from public, anon;
grant execute on function public.mark_my_notification_read(bigint) to authenticated;

notify pgrst, 'reload schema';
commit;