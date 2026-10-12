create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  relationship_status text check (relationship_status in ('single', 'taken', 'complicated', 'cruise')),
  food_personality text check (food_personality in ('indomie', 'jollof', 'pepper-soup', 'suya', 'moi-moi', 'puff-puff')),
  looking_for text check (looking_for in ('friendships', 'romance', 'just-vibes')),
  vibe text[] not null default '{}' check (vibe <@ array['lowkey', 'outside', 'deep-gist', 'chaotic-good']::text[]),
  interests text[] not null default '{}' check (interests <@ array['music', 'movies', 'food', 'games', 'gist', 'football', 'fashion', 'travel', 'books', 'tech']::text[]),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

grant select, insert, update on public.profiles to authenticated;
revoke all on public.profiles from anon;
