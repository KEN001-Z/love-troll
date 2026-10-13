begin;

alter table public.posts
  add column if not exists media_path text,
  add column if not exists media_mime text,
  add column if not exists media_kind text not null default 'none';

alter table public.posts drop constraint if exists posts_type_supported;
alter table public.posts add constraint posts_type_supported check (post_type in ('text', 'image', 'video'));
alter table public.posts add constraint posts_media_valid check (
  (media_kind = 'none' and media_path is null and media_mime is null and post_type = 'text')
  or (media_kind in ('image', 'video') and media_path is not null and media_mime is not null and post_type = media_kind)
);
grant insert (author_id, content, post_type, is_anonymous, media_path, media_mime, media_kind) on public.posts to authenticated;
grant update (content, is_anonymous, media_path, media_mime, media_kind) on public.posts to authenticated;

drop policy if exists "Users can create their own text posts" on public.posts;
create policy "Users can create their own posts with owned media"
  on public.posts for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and moderation_status = 'published'
    and exists (select 1 from public.profiles profile where profile.id = (select auth.uid()) and profile.onboarding_completed)
    and (media_path is null or media_path like (select auth.uid())::text || '/%')
  );

drop policy if exists "Users can edit their own posts" on public.posts;
create policy "Users can edit their own posts with owned media"
  on public.posts for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()) and (media_path is null or media_path like (select auth.uid())::text || '/%'));

drop function if exists public.get_public_posts(timestamptz, uuid, text, integer);

create function public.get_public_posts(
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_filter text default 'all',
  p_limit integer default 16
)
returns table (
  id uuid,
  content text,
  post_type text,
  is_anonymous boolean,
  created_at timestamptz,
  updated_at timestamptz,
  author_display_name text,
  author_profile_id uuid,
  can_edit boolean,
  media_path text,
  media_mime text,
  media_kind text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then raise exception 'You must be signed in to view the VYBE feed.'; end if;
  if p_filter is null or p_filter not in ('all', 'anonymous') then raise exception 'Choose a supported feed filter.'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 40 then raise exception 'Feed page size must be between 1 and 40.'; end if;
  if (p_before_created_at is null) <> (p_before_id is null) then raise exception 'Both feed cursor values must be provided together.'; end if;
  return query
  select post.id, post.content, post.post_type, post.is_anonymous, post.created_at, post.updated_at,
    case when post.is_anonymous or (post.author_id <> actor and profile.profile_visibility = 'private') then null::text else profile.display_name end,
    case when post.is_anonymous then null::uuid when post.author_id = actor or profile.profile_visibility = 'campus' then post.author_id else null::uuid end,
    post.author_id = actor, post.media_path, post.media_mime, post.media_kind
  from public.posts post
  left join public.profiles profile on profile.id = post.author_id
  where post.moderation_status = 'published'
    and (p_filter = 'all' or post.is_anonymous)
    and (p_before_created_at is null or (post.created_at, post.id) < (p_before_created_at, p_before_id))
  order by post.created_at desc, post.id desc
  limit p_limit;
end;
$$;

revoke all on function public.get_public_posts(timestamptz, uuid, text, integer) from public, anon;
grant execute on function public.get_public_posts(timestamptz, uuid, text, integer) to authenticated;

drop function if exists public.get_community_messages(text, timestamptz, uuid, integer);

create function public.get_community_messages(
  p_room_slug text,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  room_slug text,
  content text,
  is_anonymous boolean,
  created_at timestamptz,
  author_id uuid,
  author_display_name text,
  author_avatar_path text
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
    raise exception 'You must be signed in to view Community.';
  end if;
  if p_room_slug is null or not exists (
    select 1 from public.community_rooms room where room.slug = p_room_slug
  ) then
    raise exception 'That Community room does not exist.';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Community message page size must be between 1 and 100.';
  end if;
  if (p_before_created_at is null) <> (p_before_id is null) then
    raise exception 'Both Community message cursor values are required together.';
  end if;

  return query
  select message.id,
         message.room_slug,
         message.content,
         message.is_anonymous,
         message.created_at,
         case when message.is_anonymous then null::uuid else message.author_id end,
         case when message.is_anonymous then 'Anonymous'::text else coalesce(profile.display_name, 'VYBE member') end,
         case when message.is_anonymous then null::text else profile.avatar_path end
  from public.community_messages message
  left join public.profiles profile on profile.id = message.author_id
  where message.room_slug = p_room_slug
    and message.moderation_status = 'published'
    and (
      p_before_created_at is null
      or (message.created_at, message.id) < (p_before_created_at, p_before_id)
    )
  order by message.created_at desc, message.id desc
  limit p_limit;
end;
$$;

revoke all on function public.get_community_messages(text, timestamptz, uuid, integer) from public, anon;
grant execute on function public.get_community_messages(text, timestamptz, uuid, integer) to authenticated;

create or replace function public.get_community_message(p_message_id uuid)
returns table (
  id uuid,
  room_slug text,
  content text,
  is_anonymous boolean,
  created_at timestamptz,
  author_id uuid,
  author_display_name text,
  author_avatar_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select message.id,
         message.room_slug,
         message.content,
         message.is_anonymous,
         message.created_at,
         case when message.is_anonymous then null::uuid else message.author_id end,
         case when message.is_anonymous then 'Anonymous'::text else coalesce(profile.display_name, 'VYBE member') end,
         case when message.is_anonymous then null::text else profile.avatar_path end
  from public.community_messages message
  left join public.profiles profile on profile.id = message.author_id
  where message.id = p_message_id
    and message.moderation_status = 'published'
    and auth.uid() is not null;
$$;

revoke all on function public.get_community_message(uuid) from public, anon;
grant execute on function public.get_community_message(uuid) to authenticated;

create table public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.direct_conversation_members (
  conversation_id uuid not null references public.direct_conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create index direct_conversation_members_user_idx
  on public.direct_conversation_members (user_id, conversation_id);

create table public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  media_path text,
  media_mime text,
  media_kind text not null default 'none',
  created_at timestamptz not null default now(),
  constraint direct_messages_content_length
    check (char_length(content) between 1 and 1000 and char_length(btrim(content)) > 0),
  constraint direct_messages_media_valid
    check (
      (media_kind = 'none' and media_path is null and media_mime is null)
      or (media_kind in ('image', 'video') and media_path is not null and media_mime is not null)
    )
);

create index direct_messages_conversation_created_idx
  on public.direct_messages (conversation_id, created_at desc, id desc);
create index direct_messages_author_created_idx
  on public.direct_messages (author_id, created_at desc);

alter table public.direct_conversations enable row level security;
alter table public.direct_conversation_members enable row level security;
alter table public.direct_messages enable row level security;

revoke all on public.direct_conversations from public, anon, authenticated;
revoke all on public.direct_conversation_members from public, anon, authenticated;
revoke all on public.direct_messages from public, anon, authenticated;

create or replace function private.is_direct_member(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.direct_conversation_members member
    where member.conversation_id = p_conversation_id
      and member.user_id = auth.uid()
  );
$$;

revoke all on function private.is_direct_member(uuid) from public, anon;
grant execute on function private.is_direct_member(uuid) to authenticated;

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
    select 1 from public.profiles profile
    where profile.id in (actor, p_target_user) and profile.onboarding_completed
    having count(*) = 2
  ) then
    raise exception 'Both people must finish setting up VYBE before messaging.';
  end if;
  if not exists (
    select 1 from public.matches match
    where (match.user_a = actor and match.user_b = p_target_user)
       or (match.user_a = p_target_user and match.user_b = actor)
  ) then
    raise exception 'Private messages are available after a mutual connection.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(least(actor::text, p_target_user::text) || ':' || greatest(actor::text, p_target_user::text), 0)
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
    insert into public.direct_conversations default values returning id into conversation_id;
    insert into public.direct_conversation_members (conversation_id, user_id)
    values (conversation_id, actor), (conversation_id, p_target_user);
  end if;
  return conversation_id;
end;
$$;

revoke all on function public.start_direct_conversation(uuid) from public, anon;
grant execute on function public.start_direct_conversation(uuid) to authenticated;

create or replace function public.get_direct_conversations()
returns table (
  conversation_id uuid,
  other_user_id uuid,
  other_display_name text,
  other_avatar_path text,
  last_message text,
  last_message_at timestamptz,
  unread_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select conversation.id,
         other_member.user_id,
         coalesce(profile.display_name, 'VYBE member'),
         profile.avatar_path,
         latest.content,
         latest.created_at,
         (select count(*)
          from public.direct_messages unread
          where unread.conversation_id = conversation.id
            and unread.author_id <> auth.uid()
            and unread.created_at > coalesce(current_member.last_read_at, '-infinity'::timestamptz))
  from public.direct_conversations conversation
  join public.direct_conversation_members current_member
    on current_member.conversation_id = conversation.id and current_member.user_id = auth.uid()
  join public.direct_conversation_members other_member
    on other_member.conversation_id = conversation.id and other_member.user_id <> auth.uid()
  join public.profiles profile on profile.id = other_member.user_id
  left join lateral (
    select message.content, message.created_at
    from public.direct_messages message
    where message.conversation_id = conversation.id
    order by message.created_at desc, message.id desc
    limit 1
  ) latest on true
  order by coalesce(latest.created_at, conversation.updated_at) desc;
$$;

revoke all on function public.get_direct_conversations() from public, anon;
grant execute on function public.get_direct_conversations() to authenticated;

create or replace function public.get_direct_messages(
  p_conversation_id uuid,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  conversation_id uuid,
  content text,
  created_at timestamptz,
  author_id uuid,
  author_display_name text,
  author_avatar_path text,
  media_path text,
  media_mime text,
  media_kind text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_direct_member(p_conversation_id) then
    raise exception 'You are not a member of this conversation.';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Message page size must be between 1 and 100.';
  end if;
  return query
  select message.id, message.conversation_id, message.content, message.created_at,
         message.author_id, coalesce(profile.display_name, 'VYBE member'), profile.avatar_path,
         message.media_path, message.media_mime, message.media_kind
  from public.direct_messages message
  join public.profiles profile on profile.id = message.author_id
  where message.conversation_id = p_conversation_id
    and (p_before_created_at is null or (message.created_at, message.id) < (p_before_created_at, p_before_id))
  order by message.created_at desc, message.id desc
  limit p_limit;
end;
$$;

revoke all on function public.get_direct_messages(uuid, timestamptz, uuid, integer) from public, anon;
grant execute on function public.get_direct_messages(uuid, timestamptz, uuid, integer) to authenticated;

create or replace function public.get_direct_message(p_message_id uuid)
returns table (
  id uuid,
  conversation_id uuid,
  content text,
  created_at timestamptz,
  author_id uuid,
  author_display_name text,
  author_avatar_path text,
  media_path text,
  media_mime text,
  media_kind text
)
language sql
stable
security definer
set search_path = ''
as $$
  select message.id, message.conversation_id, message.content, message.created_at,
         message.author_id, coalesce(profile.display_name, 'VYBE member'), profile.avatar_path,
         message.media_path, message.media_mime, message.media_kind
  from public.direct_messages message
  join public.profiles profile on profile.id = message.author_id
  where message.id = p_message_id
    and private.is_direct_member(message.conversation_id);
$$;

revoke all on function public.get_direct_message(uuid) from public, anon;
grant execute on function public.get_direct_message(uuid) to authenticated;

create or replace function public.send_direct_message(
  p_conversation_id uuid,
  p_content text,
  p_media_path text default null,
  p_media_mime text default null,
  p_media_kind text default 'none'
)
returns table (id uuid, conversation_id uuid, content text, created_at timestamptz, media_path text, media_mime text, media_kind text)
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
  if pg_catalog.char_length(clean_content) < 1 or pg_catalog.char_length(clean_content) > 1000 then
    raise exception 'Messages must be between 1 and 1000 characters.';
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
        and message.content = clean_content and message.created_at > pg_catalog.now() - interval '30 seconds') then
    raise exception 'That message was already sent.';
  end if;
  insert into public.direct_messages (conversation_id, author_id, content, media_path, media_mime, media_kind)
  values (p_conversation_id, actor, clean_content, p_media_path, p_media_mime, coalesce(p_media_kind, 'none'))
  returning * into created_message;
  update public.direct_conversations set updated_at = created_message.created_at where id = p_conversation_id;
  return query select created_message.id, created_message.conversation_id, created_message.content, created_message.created_at,
    created_message.media_path, created_message.media_mime, created_message.media_kind;
end;
$$;

revoke all on function public.send_direct_message(uuid, text, text, text, text) from public, anon;
grant execute on function public.send_direct_message(uuid, text, text, text, text) to authenticated;

create or replace function public.mark_direct_conversation_read(p_conversation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_direct_member(p_conversation_id) then
    raise exception 'You are not a member of this conversation.';
  end if;
  update public.direct_conversation_members
  set last_read_at = pg_catalog.now()
  where conversation_id = p_conversation_id and user_id = auth.uid();
  return found;
end;
$$;

revoke all on function public.mark_direct_conversation_read(uuid) from public, anon;
grant execute on function public.mark_direct_conversation_read(uuid) to authenticated;

create or replace function public.broadcast_direct_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    pg_catalog.jsonb_build_object('message_id', new.id, 'conversation_id', new.conversation_id, 'created_at', new.created_at),
    'message_created',
    'direct:conversation:' || new.conversation_id::text,
    true
  );
  return new;
end;
$$;

revoke all on function public.broadcast_direct_message() from public, anon, authenticated;

create trigger direct_messages_broadcast
after insert on public.direct_messages
for each row execute function public.broadcast_direct_message();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('post-media', 'post-media', false, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']),
  ('direct-media', 'direct-media', false, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do nothing;

create policy "Authenticated users can upload their post media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Authenticated users can read published post media"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'post-media'
    and exists (
      select 1 from public.posts post
      where post.media_path = name and post.moderation_status = 'published'
    )
  );

create policy "Users can remove their post media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Conversation members can upload direct media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'direct-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.is_direct_member(((storage.foldername(name))[2])::uuid)
  );

create policy "Conversation members can read direct media"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'direct-media'
    and private.is_direct_member(((storage.foldername(name))[2])::uuid)
  );

create policy "Users can remove their direct media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'direct-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Members can receive direct message broadcasts"
  on realtime.messages for select to authenticated
  using (
    extension = 'broadcast'
    and topic like 'direct:conversation:%'
    and private.is_direct_member(substring(topic from 21)::uuid)
  );

notify pgrst, 'reload schema';
commit;
