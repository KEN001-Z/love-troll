begin;

create table public.community_rooms (
  slug text primary key,
  name text not null,
  description text not null,
  sort_order smallint not null unique,
  created_at timestamptz not null default now(),
  constraint community_rooms_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint community_rooms_name_length check (char_length(btrim(name)) between 1 and 80),
  constraint community_rooms_description_length check (char_length(btrim(description)) between 1 and 240)
);

insert into public.community_rooms (slug, name, description, sort_order)
values
  ('global', 'Global Chat', 'Everybody’s here. Say hello when the room opens.', 0),
  ('campus-gist', 'Campus Gist', 'School life, hot takes and the stories only students understand.', 1),
  ('relationships', 'Relationships & Love', 'Soft life, real talk and relationship wahala — respectfully.', 2),
  ('anonymous-gist', 'Anonymous Gist', 'Share honestly without putting your name in the spotlight.', 3),
  ('memes-cruise', 'Memes & Cruise', 'For jokes, unserious takes and the occasional “abeg rest”.', 4),
  ('music-entertainment', 'Music & Entertainment', 'What are we listening to, watching and arguing about today?', 5)
on conflict (slug) do nothing;

create table public.community_messages (
  id uuid primary key default gen_random_uuid(),
  room_slug text not null references public.community_rooms (slug) on delete restrict,
  author_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now(),
  constraint community_messages_content_length
    check (char_length(content) between 1 and 1000 and char_length(btrim(content)) > 0)
);

create index community_messages_room_created_idx
  on public.community_messages (room_slug, created_at desc, id desc);
create index community_messages_author_created_idx
  on public.community_messages (author_id, created_at desc);

alter table public.community_rooms enable row level security;
alter table public.community_messages enable row level security;

create policy "Authenticated users can read community rooms"
  on public.community_rooms for select to authenticated
  using (true);

create policy "Users can send their own community messages"
  on public.community_messages for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.profiles profile
      where profile.id = (select auth.uid())
        and profile.onboarding_completed
    )
    and exists (
      select 1 from public.community_rooms room where room.slug = community_messages.room_slug
    )
  );

create policy "Users can delete their own community messages"
  on public.community_messages for delete to authenticated
  using (author_id = (select auth.uid()));

revoke all on public.community_rooms from public, anon;
revoke all on public.community_messages from public, anon;
grant select on public.community_rooms to authenticated;
grant insert, delete on public.community_messages to authenticated;

create or replace function public.get_community_messages(
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
  author_display_name text
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
         case when message.is_anonymous then 'Anonymous'::text else coalesce(profile.display_name, 'VYBE member') end
  from public.community_messages message
  left join public.profiles profile on profile.id = message.author_id
  where message.room_slug = p_room_slug
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

create or replace function public.broadcast_community_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    pg_catalog.jsonb_build_object(
      'message_id', new.id,
      'room_slug', new.room_slug,
      'created_at', new.created_at
    ),
    'message_created',
    'community:room:' || new.room_slug,
    true
  );
  return new;
end;
$$;

revoke all on function public.broadcast_community_message() from public, anon, authenticated;

create trigger community_messages_broadcast
after insert on public.community_messages
for each row execute function public.broadcast_community_message();

create policy "Authenticated users can receive Community broadcasts"
  on realtime.messages for select to authenticated
  using (
    extension = 'broadcast'
    and topic like 'community:room:%'
  );

create policy "Authenticated users can use Community presence"
  on realtime.messages for select to authenticated
  using (
    extension = 'presence'
    and topic = 'community:presence'
  );

create policy "Authenticated users can publish Community presence"
  on realtime.messages for insert to authenticated
  with check (
    extension = 'presence'
    and topic = 'community:presence'
  );

notify pgrst, 'reload schema';
commit;
