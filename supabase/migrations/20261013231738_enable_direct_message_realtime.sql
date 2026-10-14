begin;

create or replace function public.broadcast_direct_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    pg_catalog.jsonb_build_object(
      'message_id', new.id,
      'conversation_id', new.conversation_id,
      'created_at', new.created_at
    ),
    'message_created',
    'direct:conversation:' || new.conversation_id::text,
    true
  );
  return new;
end;
$$;

revoke all on function public.broadcast_direct_message() from public, anon, authenticated;

drop trigger if exists direct_messages_broadcast on public.direct_messages;
create trigger direct_messages_broadcast
after insert on public.direct_messages
for each row execute function public.broadcast_direct_message();

drop policy if exists "Members can receive direct message broadcasts" on realtime.messages;
create policy "Members can receive direct message broadcasts"
  on realtime.messages for select to authenticated
  using (
    extension = 'broadcast'
    and topic like 'direct:conversation:%'
    and private.is_direct_member(substring(topic from 21)::uuid)
  );

notify pgrst, 'reload schema';
commit;