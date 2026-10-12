alter table public.profiles
  alter column username drop not null;

create or replace function public.set_profile_username()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.username is null or btrim(new.username) = '' then
    new.username := null;
  else
    new.username := pg_catalog.lower(pg_catalog.btrim(new.username));
  end if;
  return new;
end;
$$;

update public.profiles
set username = null
where username ~ '^student_[0-9a-f]{10}$';
