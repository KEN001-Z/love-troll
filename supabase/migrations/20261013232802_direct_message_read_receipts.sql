begin;

create or replace function public.get_direct_conversation_read_at(p_conversation_id uuid)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  other_member_read_at timestamptz;
begin
  if actor is null or not private.is_direct_member(p_conversation_id) then
    raise exception 'You are not a member of this conversation.';
  end if;

  select other_member.last_read_at
  into other_member_read_at
  from public.direct_conversation_members current_member
  join public.direct_conversation_members other_member
    on other_member.conversation_id = current_member.conversation_id
   and other_member.user_id <> actor
  where current_member.conversation_id = p_conversation_id
    and current_member.user_id = actor
  limit 1;

  return other_member_read_at;
end;
$$;

revoke all on function public.get_direct_conversation_read_at(uuid) from public, anon;
grant execute on function public.get_direct_conversation_read_at(uuid) to authenticated;

create or replace function public.mark_direct_conversation_read(p_conversation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  updated boolean;
begin
  if actor is null or not private.is_direct_member(p_conversation_id) then
    raise exception 'You are not a member of this conversation.';
  end if;

  update public.direct_conversation_members
  set last_read_at = pg_catalog.now()
  where conversation_id = p_conversation_id
    and user_id = actor;
  updated := found;

  if updated then
    perform realtime.send(
      pg_catalog.jsonb_build_object(
        'conversation_id', p_conversation_id,
        'read_by', actor
      ),
      'read_receipt',
      'direct:conversation:' || p_conversation_id::text,
      true
    );
  end if;

  return updated;
end;
$$;

revoke all on function public.mark_direct_conversation_read(uuid) from public, anon;
grant execute on function public.mark_direct_conversation_read(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;