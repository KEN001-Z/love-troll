begin;

create table public.profile_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint profile_blocks_no_self_block check (blocker_id <> blocked_id)
);

create index profile_blocks_blocked_idx
  on public.profile_blocks (blocked_id, blocker_id);

alter table public.profile_blocks enable row level security;
revoke all on public.profile_blocks from public, anon, authenticated;

create table public.profile_reports (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null,
  details text not null default '',
  created_at timestamptz not null default now(),
  constraint profile_reports_reason_valid
    check (reason in ('spam', 'harassment', 'hate', 'sexual-content', 'impersonation', 'other')),
  constraint profile_reports_details_length
    check (char_length(btrim(details)) <= 500),
  constraint profile_reports_once_per_user
    unique (profile_id, reporter_id)
);

create index profile_reports_profile_idx
  on public.profile_reports (profile_id, created_at desc);
create index profile_reports_reporter_idx
  on public.profile_reports (reporter_id, created_at desc);

alter table public.profile_reports enable row level security;
revoke all on public.profile_reports from public, anon, authenticated;

create or replace function public.is_profile_blocked(p_target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and p_target_user is not null
    and exists (
      select 1 from public.profile_blocks profile_block
      where (profile_block.blocker_id = auth.uid() and profile_block.blocked_id = p_target_user)
         or (profile_block.blocker_id = p_target_user and profile_block.blocked_id = auth.uid())
    );
$$;

revoke all on function public.is_profile_blocked(uuid) from public, anon;
grant execute on function public.is_profile_blocked(uuid) to authenticated;

create or replace function public.is_profile_blocked_by_me(p_target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and p_target_user is not null
    and exists (
      select 1 from public.profile_blocks profile_block
      where profile_block.blocker_id = auth.uid() and profile_block.blocked_id = p_target_user
    );
$$;

revoke all on function public.is_profile_blocked_by_me(uuid) from public, anon;
grant execute on function public.is_profile_blocked_by_me(uuid) to authenticated;

create or replace function public.set_profile_block(
  p_target_profile uuid,
  p_block boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'You must be signed in to manage profile blocks.';
  end if;
  if p_target_profile is null or p_target_profile = actor then
    raise exception 'You cannot block your own profile.';
  end if;
  if p_block is null then
    raise exception 'Choose whether to block or unblock this profile.';
  end if;
  if not exists (
    select 1 from public.profiles profile
    where profile.id = actor and profile.onboarding_completed
  ) then
    raise exception 'Finish setting up VYBE before managing profile blocks.';
  end if;
  if not exists (
    select 1 from public.profiles profile
    where profile.id = p_target_profile and profile.onboarding_completed
  ) then
    raise exception 'That profile is no longer available.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      least(actor::text, p_target_profile::text) || ':' ||
      greatest(actor::text, p_target_profile::text),
      0
    )
  );

  if p_block then
    insert into public.profile_blocks (blocker_id, blocked_id)
    values (actor, p_target_profile)
    on conflict (blocker_id, blocked_id) do nothing;

    delete from public.follows
    where (follower_id = actor and following_id = p_target_profile)
       or (follower_id = p_target_profile and following_id = actor);
    delete from public.discovery_likes
    where (user_id = actor and target_id = p_target_profile)
       or (user_id = p_target_profile and target_id = actor);
    delete from public.matches
    where (user_a = actor and user_b = p_target_profile)
       or (user_a = p_target_profile and user_b = actor);
    if pg_catalog.to_regclass('public.notifications') is not null then
      execute
        'delete from public.notifications where (recipient_id = $1 and actor_id = $2) or (recipient_id = $2 and actor_id = $1)'
        using actor, p_target_profile;
    end if;
    return true;
  end if;

  delete from public.profile_blocks
  where blocker_id = actor and blocked_id = p_target_profile;
  return false;
end;
$$;

revoke all on function public.set_profile_block(uuid, boolean) from public, anon;
grant execute on function public.set_profile_block(uuid, boolean) to authenticated;

create or replace function public.report_profile(
  p_target_profile uuid,
  p_reason text,
  p_details text default ''
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
  report_details text := pg_catalog.btrim(coalesce(p_details, ''));
begin
  if actor is null then
    raise exception 'You must be signed in to report a profile.';
  end if;
  if not exists (
    select 1 from public.profiles profile
    where profile.id = actor and profile.onboarding_completed
  ) then
    raise exception 'Finish setting up VYBE before reporting a profile.';
  end if;
  if p_target_profile is null or p_target_profile = actor then
    raise exception 'You cannot report your own profile.';
  end if;
  if report_reason not in ('spam', 'harassment', 'hate', 'sexual-content', 'impersonation', 'other') then
    raise exception 'Choose a valid report reason.';
  end if;
  if pg_catalog.char_length(report_details) > 500 then
    raise exception 'Report details must be 500 characters or fewer.';
  end if;
  if not exists (
    select 1 from public.profiles profile
    where profile.id = p_target_profile and profile.onboarding_completed
  ) then
    raise exception 'That profile is no longer available.';
  end if;

  insert into public.profile_reports (profile_id, reporter_id, reason, details)
  values (p_target_profile, actor, report_reason, report_details)
  returning id into report_id;
  return report_id;
exception
  when unique_violation then
    raise exception 'You have already reported this profile.';
end;
$$;

revoke all on function public.report_profile(uuid, text, text) from public, anon;
grant execute on function public.report_profile(uuid, text, text) to authenticated;

drop policy if exists "Users can discover completed profiles" on public.profiles;
create policy "Users can discover completed profiles"
  on public.profiles for select to authenticated
  using (
    id <> (select auth.uid())
    and onboarding_completed
    and not public.is_profile_blocked(id)
    and (
      relationship_status in ('single', 'complicated', 'cruise')
      or exists (
        select 1 from public.matches match
        where (match.user_a = (select auth.uid()) and match.user_b = profiles.id)
           or (match.user_b = (select auth.uid()) and match.user_a = profiles.id)
      )
    )
  );

create or replace function public.get_profile_public(target_profile uuid)
returns table (
  id uuid,
  username text,
  display_name text,
  university text,
  department text,
  academic_level text,
  bio text,
  interests text[],
  hobbies text[],
  personality_tags text[],
  current_mood text,
  catchphrase text,
  avatar_path text,
  cover_path text,
  profile_visibility text,
  looking_for text,
  can_receive_interest boolean,
  is_owner boolean,
  gender text,
  follower_count bigint,
  following_count bigint,
  like_count bigint,
  post_count bigint,
  is_following boolean
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
    raise exception 'You must be signed in to view a VYBE profile.';
  end if;
  return query
  select profile.id, profile.username, profile.display_name, profile.university,
         profile.department, profile.academic_level, profile.bio, profile.interests,
         profile.hobbies, profile.personality_tags, profile.current_mood,
         profile.catchphrase, profile.avatar_path, profile.cover_path,
         profile.profile_visibility,
         case when actor = profile.id or profile.matchmaking_enabled then profile.looking_for else null end,
         (actor <> profile.id and profile.matchmaking_enabled and profile.profile_visibility = 'campus'),
         (actor = profile.id),
         case when actor = profile.id or profile.gender <> 'prefer_not_to_say' then profile.gender else null end,
         (select pg_catalog.count(*) from public.follows follow where follow.following_id = profile.id),
         (select pg_catalog.count(*) from public.follows follow where follow.follower_id = profile.id),
         (select pg_catalog.count(*) from public.discovery_likes liked where liked.target_id = profile.id),
         (select pg_catalog.count(*) from public.posts post
          where post.author_id = profile.id
            and post.moderation_status = 'published'
            and not post.is_anonymous),
         exists (
           select 1 from public.follows follow
           where follow.follower_id = actor and follow.following_id = profile.id
         )
  from public.profiles profile
  where profile.id = target_profile
    and profile.onboarding_completed
    and exists (
      select 1 from public.profiles viewer
      where viewer.id = actor and viewer.onboarding_completed
    )
    and not public.is_profile_blocked(profile.id)
    and (
      actor = profile.id
      or profile.profile_visibility = 'campus'
      or exists (
        select 1 from public.matches match
        where (match.user_a = actor and match.user_b = profile.id)
           or (match.user_b = actor and match.user_a = profile.id)
      )
    );
end;
$$;

revoke all on function public.get_profile_public(uuid) from public, anon;
grant execute on function public.get_profile_public(uuid) to authenticated;

create or replace function public.get_profile_previews(target_ids uuid[])
returns table (id uuid, username text, display_name text, avatar_path text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'You must be signed in to view VYBE profiles.';
  end if;
  if not exists (
    select 1 from public.profiles me
    where me.id = actor and me.onboarding_completed
  ) then
    raise exception 'Finish setting up your VYBE to view profiles.';
  end if;
  return query
  select profile.id, profile.username, profile.display_name, profile.avatar_path
  from public.profiles profile
  where profile.id = any(coalesce(target_ids, array[]::uuid[]))
    and profile.onboarding_completed
    and not public.is_profile_blocked(profile.id)
    and (
      actor = profile.id
      or profile.profile_visibility = 'campus'
      or exists (
        select 1 from public.matches match
        where (match.user_a = actor and match.user_b = profile.id)
           or (match.user_b = actor and match.user_a = profile.id)
      )
    )
  limit 100;
end;
$$;

revoke all on function public.get_profile_previews(uuid[]) from public, anon;
grant execute on function public.get_profile_previews(uuid[]) to authenticated;

create or replace function public.discover_profiles(result_offset integer, result_limit integer)
returns table (
  id uuid,
  username text,
  display_name text,
  relationship_status text,
  food_personality text,
  looking_for text,
  vibe text[],
  interests text[],
  hobbies text[],
  personality_tags text[],
  university text,
  department text,
  academic_level text,
  bio text,
  current_mood text,
  avatar_path text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or not exists (
    select 1 from public.profiles me
    where me.id = actor and me.onboarding_completed
  ) then
    raise exception 'Finish setting up your VYBE to discover people.';
  end if;
  return query
  select profile.id, profile.username, profile.display_name,
         case when profile.matchmaking_enabled then profile.relationship_status else null end,
         profile.food_personality,
         case when profile.matchmaking_enabled then profile.looking_for else null end,
         profile.vibe, profile.interests, profile.hobbies, profile.personality_tags,
         profile.university, profile.department, profile.academic_level, profile.bio,
         profile.current_mood, profile.avatar_path, profile.created_at
  from public.profiles profile
  where profile.id <> actor
    and profile.onboarding_completed
    and profile.matchmaking_enabled
    and profile.profile_visibility = 'campus'
    and not public.is_profile_blocked(profile.id)
  order by profile.created_at desc, profile.id
  limit least(greatest(result_limit, 1), 100)
  offset greatest(result_offset, 0);
end;
$$;

revoke all on function public.discover_profiles(integer, integer) from public, anon;
grant execute on function public.discover_profiles(integer, integer) to authenticated;

create or replace function private.profile_media_visible(profile_owner text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.profiles profile
      where profile.id::text = profile_owner
        and profile.onboarding_completed
        and exists (
          select 1 from public.profiles viewer
          where viewer.id = auth.uid() and viewer.onboarding_completed
        )
        and not public.is_profile_blocked(profile.id)
        and (
          profile.id = auth.uid()
          or profile.profile_visibility = 'campus'
          or exists (
            select 1 from public.matches match
            where (match.user_a = auth.uid() and match.user_b = profile.id)
               or (match.user_b = auth.uid() and match.user_a = profile.id)
          )
        )
    );
$$;

revoke all on function private.profile_media_visible(text) from public, anon;
grant execute on function private.profile_media_visible(text) to authenticated;

create or replace function private.can_read_post(target_post uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.profiles viewer
      where viewer.id = auth.uid() and viewer.onboarding_completed
    )
    and exists (
      select 1
      from public.posts post
      join public.profiles author on author.id = post.author_id
      where post.id = target_post
        and post.moderation_status = 'published'
        and not public.is_profile_blocked(post.author_id)
        and (
          post.author_id = auth.uid()
          or author.profile_visibility = 'campus'
          or exists (
            select 1 from public.matches match
            where (match.user_a = auth.uid() and match.user_b = post.author_id)
               or (match.user_b = auth.uid() and match.user_a = post.author_id)
          )
        )
    );
$$;

revoke all on function private.can_read_post(uuid) from public, anon;
grant execute on function private.can_read_post(uuid) to authenticated;

create or replace function public.toggle_follow(target_user uuid)
returns table (following boolean, follower_count bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  is_following boolean;
begin
  if actor is null then
    raise exception 'You must be signed in to follow someone.';
  end if;
  if target_user is null or target_user = actor then
    raise exception 'You cannot follow yourself.';
  end if;
  if public.is_profile_blocked(target_user) then
    raise exception 'You cannot follow a profile that is blocked.';
  end if;
  if not exists (
    select 1 from public.profiles profile
    where profile.id = target_user and profile.onboarding_completed
  ) then
    raise exception 'That profile is no longer available.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      least(actor::text, target_user::text) || ':' ||
      greatest(actor::text, target_user::text),
      0
    )
  );
  if public.is_profile_blocked(target_user) then
    raise exception 'You cannot follow a profile that is blocked.';
  end if;

  select exists (
    select 1 from public.follows follow
    where follow.follower_id = actor and follow.following_id = target_user
  ) into is_following;
  if is_following then
    delete from public.follows where follower_id = actor and following_id = target_user;
    is_following := false;
  else
    insert into public.follows (follower_id, following_id)
    values (actor, target_user)
    on conflict do nothing;
    is_following := true;
  end if;
  return query select is_following,
    (select pg_catalog.count(*) from public.follows follow where follow.following_id = target_user);
end;
$$;

revoke all on function public.toggle_follow(uuid) from public, anon;
grant execute on function public.toggle_follow(uuid) to authenticated;

create or replace function public.express_interest(target_user uuid)
returns table (matched boolean, match_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  first_user uuid;
  second_user uuid;
  created_match_id uuid;
begin
  if actor is null then
    raise exception 'You must be signed in to express interest.';
  end if;
  if target_user is null or target_user = actor then
    raise exception 'Choose another VYBE member.';
  end if;
  if public.is_profile_blocked(target_user) then
    raise exception 'You cannot express interest in a profile that is blocked.';
  end if;
  if not exists (
    select 1 from public.profiles profile
    where profile.id = actor and profile.onboarding_completed and profile.matchmaking_enabled
  ) then
    raise exception 'Finish setting up your VYBE and opt into matchmaking first.';
  end if;
  if not exists (
    select 1 from public.profiles profile
    where profile.id = target_user
      and profile.onboarding_completed
      and profile.matchmaking_enabled
      and profile.relationship_status in ('single', 'complicated', 'cruise')
      and profile.looking_for is not null
      and profile.profile_visibility = 'campus'
  ) then
    raise exception 'That profile is no longer available for matchmaking.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      case when actor < target_user then actor::text else target_user::text end || ':' ||
      case when actor < target_user then target_user::text else actor::text end,
      0
    )
  );
  if public.is_profile_blocked(target_user) then
    raise exception 'You cannot express interest in a profile that is blocked.';
  end if;
  insert into public.discovery_likes (user_id, target_id)
  values (actor, target_user)
  on conflict (user_id, target_id) do nothing;
  if not exists (
    select 1 from public.discovery_likes liked
    where liked.user_id = target_user and liked.target_id = actor
  ) then
    return query select false, null::uuid;
    return;
  end if;

  first_user := case when actor < target_user then actor else target_user end;
  second_user := case when actor < target_user then target_user else actor end;
  insert into public.matches (user_a, user_b)
  values (first_user, second_user)
  on conflict (user_a, user_b) do nothing;
  select match.id into created_match_id
  from public.matches match
  where match.user_a = first_user and match.user_b = second_user;
  return query select true, created_match_id;
end;
$$;

revoke all on function public.express_interest(uuid) from public, anon;
grant execute on function public.express_interest(uuid) to authenticated;

create or replace function private.is_direct_member(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.direct_conversation_members member
      join public.direct_conversation_members other_member
        on other_member.conversation_id = member.conversation_id
       and other_member.user_id <> member.user_id
      where member.conversation_id = p_conversation_id
        and member.user_id = auth.uid()
        and not public.is_profile_blocked(other_member.user_id)
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
  if public.is_profile_blocked(p_target_user) then
    raise exception 'You cannot start a conversation with a profile that is blocked.';
  end if;
  if not exists (
    select 1 from public.profiles profile
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
  if public.is_profile_blocked(p_target_user) then
    raise exception 'You cannot start a conversation with a profile that is blocked.';
  end if;
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
         (select pg_catalog.count(*)
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
  where not public.is_profile_blocked(other_member.user_id)
  order by coalesce(latest.created_at, conversation.updated_at) desc;
$$;

revoke all on function public.get_direct_conversations() from public, anon;
grant execute on function public.get_direct_conversations() to authenticated;

notify pgrst, 'reload schema';
commit;