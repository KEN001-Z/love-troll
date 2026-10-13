begin;

create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self_follow check (follower_id <> following_id)
);

create index if not exists follows_following_idx
  on public.follows (following_id, created_at desc);

alter table public.follows enable row level security;
revoke all on public.follows from public, anon, authenticated;

create policy "Users can read their own follows"
  on public.follows for select to authenticated
  using (follower_id = (select auth.uid()) or following_id = (select auth.uid()));

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
  if actor is null then raise exception 'You must be signed in to follow someone.'; end if;
  if target_user is null or target_user = actor then raise exception 'You cannot follow yourself.'; end if;
  if not exists (select 1 from public.profiles p where p.id = target_user and p.onboarding_completed) then
    raise exception 'That profile is no longer available.';
  end if;

  select exists (select 1 from public.follows f where f.follower_id = actor and f.following_id = target_user)
    into is_following;
  if is_following then
    delete from public.follows where follower_id = actor and following_id = target_user;
    is_following := false;
  else
    insert into public.follows (follower_id, following_id) values (actor, target_user) on conflict do nothing;
    is_following := true;
  end if;

  return query select is_following,
    (select count(*) from public.follows f where f.following_id = target_user);
end;
$$;

revoke all on function public.toggle_follow(uuid) from public, anon;
grant execute on function public.toggle_follow(uuid) to authenticated;

drop function public.get_profile_public(uuid);

create function public.get_profile_public(target_profile uuid)
returns table (
  id uuid, username text, display_name text, university text, department text,
  academic_level text, bio text, interests text[], hobbies text[], personality_tags text[],
  current_mood text, catchphrase text, avatar_path text, cover_path text,
  profile_visibility text, looking_for text, can_receive_interest boolean, is_owner boolean,
  gender text, follower_count bigint, following_count bigint, like_count bigint,
  is_following boolean
)
language plpgsql stable security definer set search_path = ''
as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'You must be signed in to view a VYBE profile.'; end if;
  return query
  select p.id, p.username, p.display_name, p.university, p.department, p.academic_level,
         p.bio, p.interests, p.hobbies, p.personality_tags, p.current_mood, p.catchphrase,
         p.avatar_path, p.cover_path, p.profile_visibility,
         case when actor = p.id or p.matchmaking_enabled then p.looking_for else null end,
         (actor <> p.id and p.matchmaking_enabled and p.profile_visibility = 'campus'),
         (actor = p.id),
         case when actor = p.id or p.gender <> 'prefer_not_to_say' then p.gender else null end,
         (select count(*) from public.follows f where f.following_id = p.id),
         (select count(*) from public.follows f where f.follower_id = p.id),
         (select count(*) from public.discovery_likes l where l.target_id = p.id),
         exists (select 1 from public.follows f where f.follower_id = actor and f.following_id = p.id)
  from public.profiles p
  where p.id = target_profile
    and p.onboarding_completed
    and exists (select 1 from public.profiles me where me.id = actor and me.onboarding_completed);
end;
$$;

revoke all on function public.get_profile_public(uuid) from public, anon;
grant execute on function public.get_profile_public(uuid) to authenticated;

create or replace function public.start_direct_conversation(p_target_user uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare actor uuid := auth.uid(); conversation_id uuid;
begin
  if actor is null or p_target_user is null or actor = p_target_user then
    raise exception 'Choose another VYBE member to message.';
  end if;
  if not exists (select 1 from public.profiles p where p.id in (actor, p_target_user)
                 and p.onboarding_completed having count(*) = 2) then
    raise exception 'Both people must finish setting up VYBE before messaging.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(least(actor::text, p_target_user::text) || ':' || greatest(actor::text, p_target_user::text), 0)
  );
  select first_member.conversation_id into conversation_id
  from public.direct_conversation_members first_member
  join public.direct_conversation_members second_member
    on second_member.conversation_id = first_member.conversation_id
   and second_member.user_id = p_target_user
  where first_member.user_id = actor limit 1;
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

notify pgrst, 'reload schema';
commit;
