alter table public.profiles
  add column if not exists username text,
  add column if not exists university text,
  add column if not exists department text,
  add column if not exists academic_level text,
  add column if not exists bio text,
  add column if not exists hobbies text[] not null default '{}',
  add column if not exists personality_tags text[] not null default '{}',
  add column if not exists current_mood text,
  add column if not exists catchphrase text,
  add column if not exists avatar_path text,
  add column if not exists cover_path text,
  add column if not exists profile_visibility text not null default 'campus',
  add column if not exists matchmaking_enabled boolean not null default false;

update public.profiles
set username = 'student_' || substr(replace(id::text, '-', ''), 1, 10)
where username is null;

update public.profiles
set matchmaking_enabled = (
  onboarding_completed
  and relationship_status in ('single', 'complicated', 'cruise')
  and looking_for is not null
)
where not matchmaking_enabled;

alter table public.profiles
  alter column username set not null;

alter table public.profiles
  add constraint profiles_username_format
    check (username ~ '^[a-z0-9_]{3,24}$'),
  add constraint profiles_profile_visibility_valid
    check (profile_visibility in ('campus', 'private')),
  add constraint profiles_matchmaking_optin_valid
    check (
      not matchmaking_enabled
      or (
        onboarding_completed
        and relationship_status in ('single', 'complicated', 'cruise')
        and looking_for is not null
      )
    ),
  add constraint profiles_profile_text_lengths
    check (
      char_length(coalesce(display_name, '')) <= 80
      and
      char_length(coalesce(bio, '')) <= 280
      and char_length(coalesce(university, '')) <= 120
      and char_length(coalesce(department, '')) <= 120
      and char_length(coalesce(academic_level, '')) <= 40
      and char_length(coalesce(current_mood, '')) <= 80
      and char_length(coalesce(catchphrase, '')) <= 100
    ),
  add constraint profiles_hobbies_valid
    check (cardinality(hobbies) <= 12 and array_position(hobbies, null) is null),
  add constraint profiles_personality_tags_valid
    check (cardinality(personality_tags) <= 8 and array_position(personality_tags, null) is null);

create unique index profiles_username_lower_uidx on public.profiles (lower(username));

create or replace function public.set_profile_username()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.username is null or btrim(new.username) = '' then
    new.username := 'student_' || pg_catalog.substr(pg_catalog.replace(new.id::text, '-', ''), 1, 10);
  else
    new.username := pg_catalog.lower(pg_catalog.btrim(new.username));
  end if;
  return new;
end;
$$;

create trigger profiles_set_username
before insert or update of username on public.profiles
for each row execute function public.set_profile_username();

drop policy if exists "Users can discover completed profiles" on public.profiles;

create or replace function public.discover_profiles()
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
  avatar_path text
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
    where me.id = actor and me.onboarding_completed and me.matchmaking_enabled
  ) then
    raise exception 'Finish setting up your VYBE and opt into matchmaking to discover people.';
  end if;

  return query
  select p.id, p.username, p.display_name, p.relationship_status,
         p.food_personality, p.looking_for, p.vibe, p.interests, p.hobbies,
         p.personality_tags, p.university, p.department, p.academic_level,
         p.bio, p.current_mood, p.avatar_path
  from public.profiles p
  where p.id <> actor
    and p.onboarding_completed
    and p.matchmaking_enabled
    and p.profile_visibility = 'campus'
  order by p.created_at desc
  limit 40;
end;
$$;

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
  is_owner boolean
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
         (actor = p.id)
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
  select p.id, p.username, p.display_name, p.avatar_path
  from public.profiles p
  where p.id = any(coalesce(target_ids, array[]::uuid[]))
    and p.onboarding_completed
    and (
      actor = p.id
      or p.profile_visibility = 'campus'
      or exists (
        select 1 from public.matches m
        where (m.user_a = actor and m.user_b = p.id)
           or (m.user_b = actor and m.user_a = p.id)
      )
    )
  limit 100;
end;
$$;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

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
      from public.profiles p
      where p.id::text = profile_owner
        and p.onboarding_completed
        and exists (
          select 1 from public.profiles me
          where me.id = auth.uid() and me.onboarding_completed
        )
        and (
          p.id = auth.uid()
          or p.profile_visibility = 'campus'
          or exists (
            select 1 from public.matches m
            where (m.user_a = auth.uid() and m.user_b = p.id)
               or (m.user_b = auth.uid() and m.user_a = p.id)
          )
        )
    );
$$;

revoke all on function public.set_profile_username() from public, anon, authenticated;
revoke all on function public.discover_profiles() from public, anon;
revoke all on function public.get_profile_public(uuid) from public, anon;
revoke all on function public.get_profile_previews(uuid[]) from public, anon;
grant execute on function public.discover_profiles() to authenticated;
grant execute on function public.get_profile_public(uuid) to authenticated;
grant execute on function public.get_profile_previews(uuid[]) to authenticated;
revoke all on function private.profile_media_visible(text) from public, anon;
grant execute on function private.profile_media_visible(text) to authenticated;

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

  if not exists (
    select 1 from public.profiles p
    where p.id = actor and p.onboarding_completed and p.matchmaking_enabled
  ) then
    raise exception 'Finish setting up your VYBE and opt into matchmaking first.';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = target_user
      and p.onboarding_completed
      and p.matchmaking_enabled
      and p.relationship_status in ('single', 'complicated', 'cruise')
      and p.looking_for is not null
      and p.profile_visibility = 'campus'
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

  insert into public.discovery_likes (user_id, target_id)
  values (actor, target_user)
  on conflict (user_id, target_id) do nothing;

  if not exists (
    select 1 from public.discovery_likes l
    where l.user_id = target_user and l.target_id = actor
  ) then
    return query select false, null::uuid;
    return;
  end if;

  first_user := case when actor < target_user then actor else target_user end;
  second_user := case when actor < target_user then target_user else actor end;

  insert into public.matches (user_a, user_b)
  values (first_user, second_user)
  on conflict (user_a, user_b) do nothing;

  select m.id into created_match_id
  from public.matches m
  where m.user_a = first_user and m.user_b = second_user;

  return query select true, created_match_id;
end;
$$;

revoke all on function public.express_interest(uuid) from public, anon;
grant execute on function public.express_interest(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-media', 'profile-media', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Users can read visible profile media"
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-media'
  and private.profile_media_visible((storage.foldername(name))[1])
);

create policy "Users can upload their profile media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can delete their profile media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

grant select, insert, delete on storage.objects to authenticated;
