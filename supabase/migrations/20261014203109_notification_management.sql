begin;

create or replace function public.delete_my_notifications(p_notification_ids bigint[] default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  deleted_count integer;
begin
  if actor is null then
    raise exception 'You must be signed in to delete notifications.';
  end if;

  delete from public.notifications
  where recipient_id = actor
    and (p_notification_ids is null or id = any(p_notification_ids));

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.delete_my_notifications(bigint[]) from public, anon;
grant execute on function public.delete_my_notifications(bigint[]) to authenticated;

notify pgrst, 'reload schema';
commit;
