alter table public.profiles
  add column gender text,
  add constraint profiles_gender_length
    check (char_length(coalesce(gender, '')) <= 80);

drop function public.get_profile_public(uuid);

create function public.get_profile_public(target_profile uuid)
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
  gender text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  viewer_can_match boolean;
begin
  if actor is null then
    raise exception 'You must be signed in to view a VYBE profile.';
  end if;

  select me.onboarding_completed and me.matchmaking_enabled
  into viewer_can_match
  from public.profiles me
  where me.id = actor;
  viewer_can_match := coalesce(viewer_can_match, false);

  return query
  select p.id, p.username, p.display_name, p.university, p.department,
         p.academic_level, p.bio, p.interests, p.hobbies, p.personality_tags,
         p.current_mood, p.catchphrase, p.avatar_path, p.cover_path,
         p.profile_visibility,
         case
           when actor = p.id then p.looking_for
           when viewer_can_match and p.matchmaking_enabled then p.looking_for
           else null
         end,
         (
           actor <> p.id
           and viewer_can_match
           and p.matchmaking_enabled
           and p.profile_visibility = 'campus'
         ),
         (actor = p.id),
         case
           when actor = p.id or p.gender <> 'prefer_not_to_say' then p.gender
           else null
         end
  from public.profiles p
  where p.id = target_profile
    and p.onboarding_completed
    and (
      actor = p.id
      or (
        exists (
          select 1 from public.profiles me
          where me.id = actor and me.onboarding_completed
        )
        and (
          p.profile_visibility = 'campus'
          or exists (
            select 1 from public.matches m
            where (m.user_a = actor and m.user_b = p.id)
               or (m.user_b = actor and m.user_a = p.id)
          )
        )
      )
    );
end;
$$;

revoke all on function public.get_profile_public(uuid) from public, anon;
grant execute on function public.get_profile_public(uuid) to authenticated;

notify pgrst, 'reload schema';