begin;

alter table public.community_messages
  add column if not exists moderation_status text not null default 'published';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'community_messages_moderation_status_valid'
      and conrelid = 'public.community_messages'::regclass
  ) then
    alter table public.community_messages
      add constraint community_messages_moderation_status_valid
      check (moderation_status in ('published', 'hidden'));
  end if;
end;
$$;

create table public.community_message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.community_messages (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint community_message_reports_reason_valid
    check (reason in ('spam', 'harassment', 'hate', 'sexual-content', 'impersonation', 'other')),
  constraint community_message_reports_reason_length
    check (char_length(btrim(reason)) between 1 and 40),
  constraint community_message_reports_once_per_user
    unique (message_id, reporter_id)
);

create index community_message_reports_message_idx
  on public.community_message_reports (message_id, created_at desc);
create index community_message_reports_reporter_idx
  on public.community_message_reports (reporter_id, created_at desc);

alter table public.community_message_reports enable row level security;

create policy "Users can read their own Community reports"
  on public.community_message_reports for select to authenticated
  using (reporter_id = (select auth.uid()));

create table public.community_moderators (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.community_moderators enable row level security;

revoke all on public.community_message_reports from public, anon, authenticated;
revoke all on public.community_moderators from public, anon, authenticated;
grant select on public.community_message_reports to authenticated;

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

create or replace function public.send_community_message(
  p_room_slug text,
  p_content text,
  p_is_anonymous boolean default false
)
returns table (id uuid, room_slug text, content text, is_anonymous boolean, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  message_content text := pg_catalog.btrim(coalesce(p_content, ''));
  created_message public.community_messages;
begin
  if actor is null then
    raise exception 'You must be signed in to send a Community message.';
  end if;
  if not exists (
    select 1 from public.profiles profile
    where profile.id = actor and profile.onboarding_completed
  ) then
    raise exception 'Finish setting up your VYBE before sending a Community message.';
  end if;
  if p_room_slug is null or not exists (
    select 1 from public.community_rooms room where room.slug = p_room_slug
  ) then
    raise exception 'That Community room does not exist.';
  end if;
  if pg_catalog.char_length(message_content) < 1 or pg_catalog.char_length(message_content) > 1000 then
    raise exception 'Messages must be between 1 and 1000 characters.';
  end if;
  if (
    select count(*) from public.community_messages message
    where message.author_id = actor
      and message.created_at > pg_catalog.now() - interval '1 minute'
  ) >= 5 then
    raise exception 'You are sending messages too quickly. Please wait a little.';
  end if;
  if exists (
    select 1 from public.community_messages message
    where message.author_id = actor
      and message.room_slug = p_room_slug
      and message.content = message_content
      and message.created_at > pg_catalog.now() - interval '30 seconds'
  ) then
    raise exception 'That message was already sent.';
  end if;

  insert into public.community_messages (room_slug, author_id, content, is_anonymous)
  values (p_room_slug, actor, message_content, coalesce(p_is_anonymous, false))
  returning * into created_message;

  return query select created_message.id, created_message.room_slug, created_message.content,
    created_message.is_anonymous, created_message.created_at;
end;
$$;

revoke insert on public.community_messages from authenticated;
revoke all on function public.send_community_message(text, text, boolean) from public, anon;
grant execute on function public.send_community_message(text, text, boolean) to authenticated;

create or replace function public.report_community_message(
  p_message_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  report_id uuid;
  report_reason text := pg_catalog.btrim(coalesce(p_reason, ''));
begin
  if actor is null then
    raise exception 'You must be signed in to report a message.';
  end if;
  if report_reason not in ('spam', 'harassment', 'hate', 'sexual-content', 'impersonation', 'other') then
    raise exception 'Choose a valid report reason.';
  end if;
  if not exists (
    select 1 from public.community_messages message
    where message.id = p_message_id
  ) then
    raise exception 'That message no longer exists.';
  end if;
  insert into public.community_message_reports (message_id, reporter_id, reason)
  values (p_message_id, actor, report_reason)
  returning id into report_id;
  return report_id;
exception
  when unique_violation then
    raise exception 'You already reported this message.';
end;
$$;

revoke all on function public.report_community_message(uuid, text) from public, anon;
grant execute on function public.report_community_message(uuid, text) to authenticated;

create or replace function public.hide_community_message(p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or not exists (
    select 1 from public.community_moderators moderator where moderator.user_id = actor
  ) then
    raise exception 'You are not allowed to moderate Community messages.';
  end if;
  update public.community_messages
  set moderation_status = 'hidden'
  where id = p_message_id and moderation_status = 'published';
  return found;
end;
$$;

revoke all on function public.hide_community_message(uuid) from public, anon;
grant execute on function public.hide_community_message(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
