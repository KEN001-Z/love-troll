create table if not exists public.profile_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint profile_blocks_no_self_block check (blocker_id <> blocked_id)
);

create index if not exists profile_blocks_blocked_idx
  on public.profile_blocks (blocked_id, blocker_id);

alter table public.profile_blocks enable row level security;
revoke all on public.profile_blocks from public, anon, authenticated;

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

create or replace function public.discover_profiles(
  result_offset integer,
  result_limit integer,
  p_matchmaking_only boolean
)
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
    and profile.profile_visibility = 'campus'
    and not public.is_profile_blocked(profile.id)
    and (not p_matchmaking_only or profile.matchmaking_enabled)
  order by profile.created_at desc, profile.id
  limit least(greatest(result_limit, 1), 100)
  offset greatest(result_offset, 0);
end;
$$;

revoke all on function public.discover_profiles(integer, integer, boolean) from public, anon;
grant execute on function public.discover_profiles(integer, integer, boolean) to authenticated;

notify pgrst, 'reload schema';
