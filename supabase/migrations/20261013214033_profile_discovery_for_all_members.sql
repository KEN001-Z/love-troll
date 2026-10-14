drop function public.discover_profiles();

create function public.discover_profiles(result_offset integer, result_limit integer)
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
  select p.id, p.username, p.display_name,
         case when p.matchmaking_enabled then p.relationship_status else null end,
         p.food_personality,
         case when p.matchmaking_enabled then p.looking_for else null end,
         p.vibe, p.interests, p.hobbies, p.personality_tags, p.university,
         p.department, p.academic_level, p.bio, p.current_mood, p.avatar_path,
         p.created_at
  from public.profiles p
  where p.id <> actor
    and p.onboarding_completed
    and p.matchmaking_enabled
    and p.profile_visibility = 'campus'
  order by p.created_at desc, p.id
  limit least(greatest(result_limit, 1), 100)
  offset greatest(result_offset, 0);
end;
$$;

revoke all on function public.discover_profiles(integer, integer) from public, anon;
grant execute on function public.discover_profiles(integer, integer) to authenticated;

grant select on public.follows to authenticated;

notify pgrst, 'reload schema';