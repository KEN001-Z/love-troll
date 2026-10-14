begin;

create or replace function public.start_direct_conversation(p_target_user uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  conversation_id uuid;
begin
  if actor is null or p_target_user is null or actor = p_target_user then
    raise exception 'Choose another VYBE member to message.';
  end if;
  if not exists (
    select 1
    from public.profiles profile
    where profile.id in (actor, p_target_user)
      and profile.onboarding_completed
    having count(*) = 2
  ) then
    raise exception 'Both people must finish setting up VYBE before messaging.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      least(actor::text, p_target_user::text) || ':' ||
      greatest(actor::text, p_target_user::text),
      0
    )
  );

  select first_member.conversation_id
  into conversation_id
  from public.direct_conversation_members first_member
  join public.direct_conversation_members second_member
    on second_member.conversation_id = first_member.conversation_id
   and second_member.user_id = p_target_user
  where first_member.user_id = actor
  limit 1;

  if conversation_id is null then
    insert into public.direct_conversations default values
    returning id into conversation_id;
    insert into public.direct_conversation_members (conversation_id, user_id)
    values (conversation_id, actor), (conversation_id, p_target_user);
  end if;

  return conversation_id;
end;
$$;

revoke all on function public.start_direct_conversation(uuid) from public, anon;
grant execute on function public.start_direct_conversation(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;