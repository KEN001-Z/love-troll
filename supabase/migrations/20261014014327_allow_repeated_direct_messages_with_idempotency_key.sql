begin;

alter table public.direct_messages
  add column if not exists client_message_id uuid;

create unique index if not exists direct_messages_author_conversation_client_message_id_uidx
  on public.direct_messages (author_id, conversation_id, client_message_id)
  where client_message_id is not null;

drop function public.send_direct_message(uuid, text, text, text, text);

create function public.send_direct_message(
  p_conversation_id uuid,
  p_content text,
  p_media_path text default null,
  p_media_mime text default null,
  p_media_kind text default 'none',
  p_client_message_id uuid default null
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

  insert into public.direct_messages (
    conversation_id, author_id, content, media_path, media_mime, media_kind, client_message_id
  )
  values (
    p_conversation_id, actor, clean_content, p_media_path, p_media_mime,
    coalesce(p_media_kind, 'none'), p_client_message_id
  )
  on conflict (author_id, conversation_id, client_message_id)
    where client_message_id is not null
    do nothing
  returning * into created_message;

  if not found then
    select message.*
    into created_message
    from public.direct_messages message
    where message.author_id = actor
      and message.conversation_id = p_conversation_id
      and message.client_message_id = p_client_message_id;

    if not found then
      raise exception 'The message could not be confirmed. Please try again.';
    end if;
    if created_message.content <> clean_content
       or created_message.media_path is distinct from p_media_path
       or created_message.media_mime is distinct from p_media_mime
       or created_message.media_kind <> coalesce(p_media_kind, 'none') then
      raise exception 'That message ID has already been used for a different message.';
    end if;

    return query
    select created_message.id, created_message.conversation_id, created_message.content, created_message.created_at,
      created_message.media_path, created_message.media_mime, created_message.media_kind;
    return;
  end if;

  update public.direct_conversations as conversation
  set updated_at = created_message.created_at
  where conversation.id = p_conversation_id;

  return query
  select created_message.id, created_message.conversation_id, created_message.content, created_message.created_at,
    created_message.media_path, created_message.media_mime, created_message.media_kind;
end;
$$;

revoke all on function public.send_direct_message(uuid, text, text, text, text, uuid) from public, anon;
grant execute on function public.send_direct_message(uuid, text, text, text, text, uuid) to authenticated;

notify pgrst, 'reload schema';
commit;