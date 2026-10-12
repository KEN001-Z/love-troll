-- Add authenticated profile discovery, private interests, and mutual matches.
-- This migration expects the public.profiles table created by
-- 20261011211437_create_vybe_profiles.sql.

create table if not exists public.discovery_likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, target_id),
  constraint discovery_likes_not_self check (user_id <> target_id)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint matches_canonical_pair check (user_a < user_b),
  constraint matches_unique_pair unique (user_a, user_b)
);

create index if not exists discovery_likes_target_idx
  on public.discovery_likes (target_id);
create index if not exists matches_user_a_idx on public.matches (user_a);
create index if not exists matches_user_b_idx on public.matches (user_b);

alter table public.discovery_likes enable row level security;
alter table public.matches enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'Users can discover completed profiles'
  ) then
    create policy "Users can discover completed profiles"
      on public.profiles for select to authenticated
      using (
        id <> (select auth.uid())
        and onboarding_completed
        and (
          relationship_status in ('single', 'complicated', 'cruise')
          or exists (
            select 1 from public.matches m
            where (m.user_a = (select auth.uid()) and m.user_b = profiles.id)
               or (m.user_b = (select auth.uid()) and m.user_a = profiles.id)
          )
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'discovery_likes'
      and policyname = 'Users can read their sent interests'
  ) then
    create policy "Users can read their sent interests"
      on public.discovery_likes for select to authenticated
      using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'matches'
      and policyname = 'Users can read their own matches'
  ) then
    create policy "Users can read their own matches"
      on public.matches for select to authenticated
      using ((select auth.uid()) in (user_a, user_b));
  end if;
end
$$;

revoke all on public.discovery_likes from anon, authenticated;
revoke all on public.matches from anon, authenticated;
grant select on public.discovery_likes, public.matches to authenticated;

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
    where p.id = actor and p.onboarding_completed
  ) then
    raise exception 'Finish setting up your VYBE before expressing interest.';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = target_user
      and p.onboarding_completed
      and p.relationship_status in ('single', 'complicated', 'cruise')
  ) then
    raise exception 'That profile is no longer available.';
  end if;

  -- Serialize actions for this pair so simultaneous likes cannot miss a match.
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
