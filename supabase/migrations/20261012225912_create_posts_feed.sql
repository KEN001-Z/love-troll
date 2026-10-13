begin;

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  post_type text not null default 'text',
  is_anonymous boolean not null default false,
  moderation_status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_content_length
    check (char_length(content) between 1 and 2000 and char_length(btrim(content)) > 0),
  constraint posts_type_supported check (post_type = 'text'),
  constraint posts_moderation_status_valid
    check (moderation_status in ('published', 'removed'))
);

create index posts_public_feed_created_idx
  on public.posts (created_at desc, id desc)
  where moderation_status = 'published';

create index posts_public_anonymous_feed_created_idx
  on public.posts (created_at desc, id desc)
  where moderation_status = 'published' and is_anonymous;

create index posts_author_created_idx
  on public.posts (author_id, created_at desc, id desc);

alter table public.posts enable row level security;

create policy "Authors and signed-in users can read eligible posts"
  on public.posts for select to authenticated
  using (
    author_id = (select auth.uid())
    or (moderation_status = 'published' and not is_anonymous)
  );

create policy "Users can create their own text posts"
  on public.posts for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and post_type = 'text'
    and moderation_status = 'published'
    and exists (
      select 1 from public.profiles as profile
      where profile.id = (select auth.uid())
        and profile.onboarding_completed
    )
  );

create policy "Users can edit their own posts"
  on public.posts for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "Users can delete their own posts"
  on public.posts for delete to authenticated
  using (author_id = (select auth.uid()));

revoke all on public.posts from public, anon, authenticated;
grant select, delete on public.posts to authenticated;
grant insert (author_id, content, post_type, is_anonymous) on public.posts to authenticated;
grant update (content, is_anonymous) on public.posts to authenticated;

create function public.set_post_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.set_post_updated_at() from public, anon, authenticated;

create trigger posts_set_updated_at
before update on public.posts
for each row execute function public.set_post_updated_at();

create function public.get_public_posts(
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_filter text default 'all',
  p_limit integer default 16
)
returns table (
  id uuid,
  content text,
  post_type text,
  is_anonymous boolean,
  created_at timestamptz,
  updated_at timestamptz,
  author_display_name text,
  author_profile_id uuid,
  can_edit boolean
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
    raise exception 'You must be signed in to view the VYBE feed.';
  end if;

  if p_filter is null or p_filter not in ('all', 'anonymous') then
    raise exception 'Choose a supported feed filter.';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 40 then
    raise exception 'Feed page size must be between 1 and 40.';
  end if;

  if (p_before_created_at is null) <> (p_before_id is null) then
    raise exception 'Both feed cursor values must be provided together.';
  end if;

  return query
  select
    post.id,
    post.content,
    post.post_type,
    post.is_anonymous,
    post.created_at,
    post.updated_at,
    case
      when post.is_anonymous or (post.author_id <> actor and profile.profile_visibility = 'private')
        then null::text
      else profile.display_name
    end,
    case
      when post.is_anonymous then null::uuid
      when post.author_id = actor or profile.profile_visibility = 'campus' then post.author_id
      else null::uuid
    end,
    post.author_id = actor
  from public.posts as post
  left join public.profiles as profile on profile.id = post.author_id
  where post.moderation_status = 'published'
    and (p_filter = 'all' or post.is_anonymous)
    and (
      p_before_created_at is null
      or (post.created_at, post.id) < (p_before_created_at, p_before_id)
    )
  order by post.created_at desc, post.id desc
  limit p_limit;
end;
$$;

revoke all on function public.get_public_posts(timestamptz, uuid, text, integer) from public, anon;
grant execute on function public.get_public_posts(timestamptz, uuid, text, integer) to authenticated;

commit;
