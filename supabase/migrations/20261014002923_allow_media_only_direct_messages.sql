begin;

alter table public.direct_messages
  drop constraint if exists direct_messages_content_length;

alter table public.direct_messages
  add constraint direct_messages_content_length
  check (
    char_length(content) between 0 and 1000
    and (
      char_length(btrim(content)) > 0
      or (
        media_kind = 'image'
        and media_path is not null
        and media_mime is not null
      )
    )
  );

create or replace function public.send_direct_message(
  p_conversation_id uuid,
  p_content text,
  p_media_path text default null,
  p_media_mime text default null,
  p_media_kind text default 'none'
)
returns table (
  id uuid,
  conversation_id uuid,
  content text,
  created_at timestamptz,
  media_path text,
  media_mime text,
  media_kind text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  clean_content text := pg_catalog.btrim(coalesce(p_content, ''));
  created_message public.direct_messages;
begin
  if actor is null or not private.is_direct_member(p_conversation_id) then
    raise exception 'You are not a member of this conversation.';
  end if;
  if pg_catalog.char_length(clean_content) > 1000
     or (pg_catalog.char_length(clean_content) < 1 and coalesce(p_media_kind, 'none') <> 'image') then
    raise exception 'Text messages and video captions need 1 to 1000 characters; photo captions may be empty and must not exceed 1000 characters.';
  end if;
  if coalesce(p_media_kind, 'none') not in ('none', 'image', 'video')
     or (coalesce(p_media_kind, 'none') <> 'none' and (p_media_path is null or p_media_mime is null))
     or (coalesce(p_media_kind, 'none') = 'none' and (p_media_path is not null or p_media_mime is not null)) then
    raise exception 'That attachment is not valid.';
  end if;
  if p_media_path is not null and p_media_path not like actor::text || '/' || p_conversation_id::text || '/%' then
    raise exception 'That attachment does not belong to this chat.';
  end if;
  if (select count(*) from public.direct_messages message
      where message.author_id = actor and message.created_at > pg_catalog.now() - interval '1 minute') >= 10 then
    raise exception 'You are sending messages too quickly. Please wait a little.';
  end if;
  if exists (select 1 from public.direct_messages message
      where message.author_id = actor and message.conversation_id = p_conversation_id
        and message.content = clean_content
        and message.media_kind = coalesce(p_media_kind, 'none')
        and message.media_path is not distinct from p_media_path
        and message.created_at > pg_catalog.now() - interval '30 seconds') then
    raise exception 'That message was already sent.';
  end if;
  insert into public.direct_messages (conversation_id, author_id, content, media_path, media_mime, media_kind)
  values (p_conversation_id, actor, clean_content, p_media_path, p_media_mime, coalesce(p_media_kind, 'none'))
  returning * into created_message;
  update public.direct_conversations as conversation
  set updated_at = created_message.created_at
  where conversation.id = p_conversation_id;
  return query
  select created_message.id, created_message.conversation_id, created_message.content, created_message.created_at,
    created_message.media_path, created_message.media_mime, created_message.media_kind;
end;
$$;

revoke all on function public.send_direct_message(uuid, text, text, text, text) from public, anon;
grant execute on function public.send_direct_message(uuid, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
commit;