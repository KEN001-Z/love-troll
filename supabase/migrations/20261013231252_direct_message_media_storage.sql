begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'direct-media',
  'direct-media',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Conversation members can upload direct media'
  ) then
    execute 'create policy "Conversation members can upload direct media"
      on storage.objects for insert to authenticated
      with check (
        bucket_id = ''direct-media''
        and (storage.foldername(name))[1] = (select auth.uid())::text
        and private.is_direct_member(((storage.foldername(name))[2])::uuid)
      )';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Conversation members can read direct media'
  ) then
    execute 'create policy "Conversation members can read direct media"
      on storage.objects for select to authenticated
      using (
        bucket_id = ''direct-media''
        and private.is_direct_member(((storage.foldername(name))[2])::uuid)
      )';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Users can remove their direct media'
  ) then
    execute 'create policy "Users can remove their direct media"
      on storage.objects for delete to authenticated
      using (
        bucket_id = ''direct-media''
        and (storage.foldername(name))[1] = (select auth.uid())::text
      )';
  end if;
end;
$$;

commit;