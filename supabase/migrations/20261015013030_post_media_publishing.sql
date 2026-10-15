begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter table public.posts
  add column if not exists media_path text,
  add column if not exists media_mime text,
  add column if not exists media_kind text not null default 'none';

alter table public.posts drop constraint if exists posts_type_supported;
alter table public.posts add constraint posts_type_supported
  check (post_type in ('text', 'image', 'video'));
alter table public.posts drop constraint if exists posts_media_valid;
alter table public.posts add constraint posts_media_valid check (
  (media_kind = 'none' and media_path is null and media_mime is null and post_type = 'text')
  or (media_kind in ('image', 'video') and media_path is not null and media_mime is not null and post_type = media_kind)
);

grant insert (id, media_path, media_mime, media_kind) on public.posts to authenticated;
grant update (media_path, media_mime, media_kind) on public.posts to authenticated;

drop policy if exists "Users can create their own text posts" on public.posts;
drop policy if exists "Users can create their own posts with owned media" on public.posts;
create policy "Users can create their own posts with owned media"
  on public.posts for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and moderation_status = 'published'
    and exists (
      select 1
      from public.profiles profile
      where profile.id = (select auth.uid())
        and profile.onboarding_completed
    )
    and (media_path is null or media_path like (select auth.uid())::text || '/%')
  );

drop policy if exists "Users can edit their own posts" on public.posts;
drop policy if exists "Users can edit their own posts with owned media" on public.posts;
create policy "Users can edit their own posts with owned media"
  on public.posts for update to authenticated
  using (author_id = (select auth.uid()))
  with check (
    author_id = (select auth.uid())
    and (media_path is null or media_path like (select auth.uid())::text || '/%')
  );

create or replace function private.can_read_post(target_post uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  post_author uuid;
  is_blocked boolean := false;
begin
  if actor is null or not exists (
    select 1
    from public.profiles viewer
    where viewer.id = actor and viewer.onboarding_completed
  ) then
    return false;
  end if;

  select post.author_id into post_author
  from public.posts post
  join public.profiles author on author.id = post.author_id
  where post.id = target_post
    and post.moderation_status = 'published'
    and (
      post.author_id = actor
      or author.profile_visibility = 'campus'
      or exists (
        select 1
        from public.matches match
        where (match.user_a = actor and match.user_b = post.author_id)
           or (match.user_b = actor and match.user_a = post.author_id)
      )
    );

  if post_author is null then
    return false;
  end if;

  if pg_catalog.to_regclass('public.profile_blocks') is not null then
    execute
      'select exists (
         select 1 from public.profile_blocks block
         where (block.blocker_id = $1 and block.blocked_id = $2)
            or (block.blocker_id = $2 and block.blocked_id = $1)
       )'
      into is_blocked
      using actor, post_author;
  end if;

  return not is_blocked;
end;
$$;

revoke all on function private.can_read_post(uuid) from public, anon;
grant execute on function private.can_read_post(uuid) to authenticated;

create table if not exists public.post_media_assets (
  post_id uuid not null references public.posts (id) on delete cascade,
  position smallint not null check (position between 2 and 10),
  media_path text not null unique,
  media_mime text not null,
  media_kind text not null check (media_kind = 'image'),
  primary key (post_id, position)
);

alter table public.post_media_assets enable row level security;
revoke all on public.post_media_assets from public, anon, authenticated;
grant select, insert on public.post_media_assets to authenticated;

drop policy if exists "Eligible members can read post media assets" on public.post_media_assets;
create policy "Eligible members can read post media assets"
  on public.post_media_assets for select to authenticated
  using (private.can_read_post(post_id));

drop policy if exists "Authors can add ordered photo assets" on public.post_media_assets;
create policy "Authors can add ordered photo assets"
  on public.post_media_assets for insert to authenticated
  with check (
    position between 2 and 10
    and media_kind = 'image'
    and media_path like (select auth.uid())::text || '/%'
    and exists (
      select 1
      from public.posts post
      where post.id = post_id
        and post.author_id = (select auth.uid())
        and post.post_type = 'image'
    )
  );

drop policy if exists "Authors and signed-in users can read eligible posts" on public.posts;
drop policy if exists "Authors and eligible members can read posts" on public.posts;
create policy "Authors and eligible members can read posts"
  on public.posts for select to authenticated
  using (
    author_id = (select auth.uid())
    or (
      moderation_status = 'published'
      and not is_anonymous
      and private.can_read_post(id)
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-media',
  'post-media',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users can upload their post media" on storage.objects;
create policy "Authenticated users can upload their post media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create or replace function private.can_read_post_media(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.posts post
    where post.media_path = object_name
      and private.can_read_post(post.id)
  )
  or exists (
    select 1
    from public.post_media_assets asset
    where asset.media_path = object_name
      and private.can_read_post(asset.post_id)
  );
$$;

revoke all on function private.can_read_post_media(text) from public, anon;
grant execute on function private.can_read_post_media(text) to authenticated;

drop policy if exists "Authenticated users can read published post media" on storage.objects;
drop policy if exists "Eligible members can read published post media" on storage.objects;
create policy "Eligible members can read published post media"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'post-media'
    and private.can_read_post_media(name)
  );

drop policy if exists "Users can remove their post media" on storage.objects;
create policy "Users can remove their post media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create or replace function public.create_post_with_media(
  p_post_id uuid,
  p_content text,
  p_is_anonymous boolean default false,
  p_media jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  clean_content text := pg_catalog.btrim(p_content);
  media jsonb := coalesce(p_media, '[]'::jsonb);
  media_count integer;
  media_type text;
  created_post public.posts;
  media_items jsonb;
begin
  if actor is null then
    raise exception 'You must be signed in to publish a post.';
  end if;
  if p_post_id is null then
    raise exception 'A post ID is required to publish a post.';
  end if;
  if clean_content is null or pg_catalog.char_length(clean_content) not between 1 and 2000 then
    raise exception 'Write a post between 1 and 2000 characters.';
  end if;
  if pg_catalog.jsonb_typeof(media) <> 'array' then
    raise exception 'Post media must be provided as a list.';
  end if;

  select pg_catalog.count(*)::integer into media_count
  from pg_catalog.jsonb_array_elements(media);
  if media_count > 10 then
    raise exception 'Add no more than 10 photos to one post.';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(media) as item(value)
    where pg_catalog.jsonb_typeof(item.value) is distinct from 'object'
       or pg_catalog.jsonb_typeof(item.value -> 'path') is distinct from 'string'
       or pg_catalog.jsonb_typeof(item.value -> 'mime') is distinct from 'string'
       or pg_catalog.jsonb_typeof(item.value -> 'kind') is distinct from 'string'
  ) then
    raise exception 'Each media item must include its uploaded path, MIME type, and kind.';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(media) as item(path text, mime text, kind text)
    where item.path is null
       or item.path not like actor::text || '/%'
       or item.kind not in ('image', 'video')
       or (item.kind = 'image' and item.mime not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif'))
       or (item.kind = 'video' and item.mime not in ('video/mp4', 'video/webm', 'video/quicktime'))
  ) then
    raise exception 'Post media type or storage path is not supported.';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(media) as item(path text, mime text, kind text)
    group by item.path
    having pg_catalog.count(*) > 1
  ) then
    raise exception 'A media file can only be attached once.';
  end if;
  if media_count > 1 and exists (
    select 1
    from pg_catalog.jsonb_to_recordset(media) as item(path text, mime text, kind text)
    where item.kind <> 'image'
  ) then
    raise exception 'A video post can contain one clip; photo posts can contain up to 10 images.';
  end if;

  select item.value ->> 'kind' into media_type
  from pg_catalog.jsonb_array_elements(media) with ordinality as item(value, ordinality)
  order by item.ordinality
  limit 1;

  insert into public.posts (
    id, author_id, content, post_type, is_anonymous, media_path, media_mime, media_kind
  )
  select p_post_id, actor, clean_content, coalesce(media_type, 'text'), coalesce(p_is_anonymous, false),
         item.path, item.mime, coalesce(item.kind, 'none')
  from (select 1) as seed
  left join lateral (
    select item.value ->> 'path' as path,
           item.value ->> 'mime' as mime,
           item.value ->> 'kind' as kind
    from pg_catalog.jsonb_array_elements(media) with ordinality as item(value, ordinality)
    order by item.ordinality
    limit 1
  ) as item on true
  returning * into created_post;

  insert into public.post_media_assets (post_id, position, media_path, media_mime, media_kind)
  select created_post.id, item.ordinality::smallint, item.value ->> 'path',
         item.value ->> 'mime', item.value ->> 'kind'
  from pg_catalog.jsonb_array_elements(media) with ordinality as item(value, ordinality)
  where item.ordinalinality > 1;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('path', assets.path, 'mime', assets.mime, 'kind', assets.kind)
      order by assets.position
    ),
    '[]'::jsonb
  )
  into media_items
  from (
    select 1 as position, created_post.media_path as path,
           created_post.media_mime as mime, created_post.media_kind as kind
    where created_post.media_path is not null
    union all
    select asset.position, asset.media_path, asset.media_mime, asset.media_kind
    from public.post_media_assets asset
    where asset.post_id = created_post.id
  ) as assets;

  return pg_catalog.to_jsonb(created_post)
    || pg_catalog.jsonb_build_object('media_items', media_items);
end;
$$;

revoke all on function public.create_post_with_media(uuid, text, boolean, jsonb) from public, anon;
grant execute on function public.create_post_with_media(uuid, text, boolean, jsonb) to authenticated;

drop function if exists public.get_public_posts(timestamptz, uuid, text, integer);
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
  can_edit boolean,
  media_path text,
  media_mime text,
  media_kind text,
  media_items jsonb
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
    select 1 from public.profiles viewer
    where viewer.id = actor and viewer.onboarding_completed
  ) then
    raise exception 'Finish setting up VYBE before viewing the feed.';
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
  select post.id, post.content, post.post_type, post.is_anonymous, post.created_at, post.updated_at,
    case when post.is_anonymous then null::text else profile.display_name end,
    case when post.is_anonymous then null::uuid else post.author_id end,
    post.author_id = actor,
    post.media_path, post.media_mime, post.media_kind,
    coalesce(media.media_items, '[]'::jsonb)
  from public.posts post
  join public.profiles profile on profile.id = post.author_id
  left join lateral (
    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('path', assets.path, 'mime', assets.mime, 'kind', assets.kind)
      order by assets.position
    ) as media_items
    from (
      select 1 as position, post.media_path as path,
             post.media_mime as mime, post.media_kind as kind
      where post.media_path is not null
      union all
      select asset.position, asset.media_path, asset.media_mime, asset.media_kind
      from public.post_media_assets asset
      where asset.post_id = post.id
    ) as assets
  ) media on true
  where post.moderation_status = 'published'
    and (p_filter = 'all' or post.is_anonymous)
    and private.can_read_post(post.id)
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

notify pgrst, 'reload schema';
commit;