begin;

create extension if not exists pg_net with schema extensions;

alter table public.notifications
  drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('follow', 'interest', 'match', 'message'));
alter table public.notifications
  add column if not exists conversation_id uuid
  references public.direct_conversations (id) on delete set null;

create index if not exists notifications_message_dedup_idx
  on public.notifications (recipient_id, actor_id, conversation_id, created_at desc)
  where kind = 'message';

create table public.push_notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  enabled boolean not null default true,
  messages boolean not null default true,
  connections boolean not null default true,
  community boolean not null default true,
  social boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.push_notification_preferences enable row level security;
revoke all on public.push_notification_preferences from public, anon, authenticated;
grant select, insert, update on public.push_notification_preferences to authenticated;
grant select on public.push_notification_preferences to service_role;

create policy "Users can read their own push preferences"
  on public.push_notification_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can create their own push preferences"
  on public.push_notification_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their own push preferences"
  on public.push_notification_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  user_agent text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_valid
    check (char_length(endpoint) between 1 and 2048 and endpoint like 'https://%'),
  constraint push_subscriptions_key_lengths
    check (
      char_length(p256dh) between 20 and 256
      and char_length(auth_secret) between 16 and 256
      and char_length(user_agent) <= 300
    )
);

create index push_subscriptions_user_active_idx
  on public.push_subscriptions (user_id, id)
  where active;

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from public, anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;
grant select, update on public.push_subscriptions to service_role;

create policy "Users can read their own push subscriptions"
  on public.push_subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can delete their own push subscriptions"
  on public.push_subscriptions for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.register_my_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth_secret text,
  p_user_agent text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  subscription_id uuid;
  active_count integer;
begin
  if actor is null then
    raise exception 'You must be signed in to enable push notifications.';
  end if;

  if p_endpoint is null or p_endpoint !~ '^https://' or char_length(p_endpoint) > 2048
     or p_p256dh is null or char_length(p_p256dh) not between 20 and 256
     or p_auth_secret is null or char_length(p_auth_secret) not between 16 and 256
     or char_length(coalesce(p_user_agent, '')) > 300 then
    raise exception 'The browser returned an invalid push subscription.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor::text, 0)
  );

  select count(*)::integer into active_count
  from public.push_subscriptions
  where user_id = actor and active;

  if active_count >= 10 and not exists (
    select 1 from public.push_subscriptions
    where endpoint = p_endpoint and user_id = actor
  ) then
    raise exception 'This account already has the maximum of 10 active devices.';
  end if;

  insert into public.push_subscriptions (
    user_id, endpoint, p256dh, auth_secret, user_agent, active, updated_at
  )
  values (
    actor, p_endpoint, p_p256dh, p_auth_secret, coalesce(p_user_agent, ''), true, pg_catalog.now()
  )
  on conflict (endpoint) do update
  set user_id = excluded.user_id,
      p256dh = excluded.p256dh,
      auth_secret = excluded.auth_secret,
      user_agent = excluded.user_agent,
      active = true,
      updated_at = pg_catalog.now()
  returning id into subscription_id;

  insert into public.push_notification_preferences (user_id)
  values (actor)
  on conflict (user_id) do nothing;

  return subscription_id;
end;
$$;

revoke all on function public.register_my_push_subscription(text, text, text, text)
  from public, anon;
grant execute on function public.register_my_push_subscription(text, text, text, text)
  to authenticated;

create table public.push_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id bigint not null unique
    references public.notifications (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('follow', 'interest', 'match', 'message')),
  category text not null check (category in ('messages', 'connections', 'community', 'social')),
  conversation_id uuid references public.direct_conversations (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'partial', 'suppressed', 'no_subscriptions', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint push_notification_outbox_no_self check (recipient_id <> actor_id)
);

create index push_notification_outbox_pending_idx
  on public.push_notification_outbox (created_at)
  where status = 'pending';

alter table public.push_notification_outbox enable row level security;
revoke all on public.push_notification_outbox from public, anon, authenticated;
grant select, update on public.push_notification_outbox to service_role;
grant select on public.profile_blocks to service_role;

create or replace function private.enqueue_vybe_push_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  outbox_id uuid;
  function_url text;
  hook_secret text;
  error_message text;
begin
  if new.recipient_id = new.actor_id then
    return new;
  end if;

  if exists (
    select 1
    from public.profile_blocks profile_block
    where (profile_block.blocker_id = new.recipient_id and profile_block.blocked_id = new.actor_id)
       or (profile_block.blocker_id = new.actor_id and profile_block.blocked_id = new.recipient_id)
  ) then
    return new;
  end if;

  if new.kind = 'follow' and exists (
    select 1
    from public.push_notification_outbox recent
    where recent.recipient_id = new.recipient_id
      and recent.actor_id = new.actor_id
      and recent.kind = new.kind
      and recent.created_at >= new.created_at - interval '15 minutes'
  ) then
    return new;
  end if;

  insert into public.push_notification_outbox (
    notification_id, recipient_id, actor_id, kind, category, conversation_id
  )
  values (
    new.id,
    new.recipient_id,
    new.actor_id,
    new.kind,
    case new.kind
      when 'message' then 'messages'
      when 'interest' then 'connections'
      when 'match' then 'connections'
      else 'social'
    end,
    new.conversation_id
  )
  on conflict (notification_id) do nothing
  returning id into outbox_id;

  if outbox_id is null then
    return new;
  end if;

  begin
    select
      max(secret.decrypted_secret) filter (where secret.name = 'vybe_push_function_url'),
      max(secret.decrypted_secret) filter (where secret.name = 'vybe_push_webhook_secret')
    into function_url, hook_secret
    from vault.decrypted_secrets secret
    where secret.name in ('vybe_push_function_url', 'vybe_push_webhook_secret');

    if function_url is null or hook_secret is null or char_length(hook_secret) < 32 then
      return new;
    end if;

    perform net.http_post(
      url := function_url,
      body := pg_catalog.jsonb_build_object('event_id', outbox_id),
      headers := pg_catalog.jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (
          select secret.decrypted_secret
          from vault.decrypted_secrets secret
          where secret.name = 'vybe_push_publishable_key'
          limit 1
        ),
        'x-vybe-push-secret', hook_secret
      ),
      timeout_milliseconds := 2000
    );
  exception when others then
    get stacked diagnostics error_message = message_text;
    update public.push_notification_outbox
    set status = 'failed',
        attempt_count = attempt_count + 1,
        last_error = pg_catalog.left(sqlstate || ': ' || error_message, 1000),
        completed_at = pg_catalog.now()
    where id = outbox_id;
  end;

  return new;
end;
$$;

revoke all on function private.enqueue_vybe_push_notification() from public, anon, authenticated;

create trigger notifications_enqueue_web_push
after insert on public.notifications
for each row execute function private.enqueue_vybe_push_notification();

create or replace function private.notify_new_direct_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (recipient_id, actor_id, kind, conversation_id)
  select member.user_id, new.author_id, 'message', new.conversation_id
  from public.direct_conversation_members member
  where member.conversation_id = new.conversation_id
    and member.user_id <> new.author_id
    and (member.last_read_at is null or member.last_read_at < new.created_at)
    and not exists (
      select 1
      from public.profile_blocks profile_block
      where (profile_block.blocker_id = member.user_id and profile_block.blocked_id = new.author_id)
         or (profile_block.blocker_id = new.author_id and profile_block.blocked_id = member.user_id)
    )
    and not exists (
      select 1
      from public.notifications recent
      where recent.recipient_id = member.user_id
        and recent.actor_id = new.author_id
        and recent.kind = 'message'
        and recent.conversation_id = new.conversation_id
        and recent.created_at >= new.created_at - interval '5 minutes'
    );
  return new;
end;
$$;

revoke all on function private.notify_new_direct_message() from public, anon, authenticated;

create trigger direct_messages_notify_recipient
after insert on public.direct_messages
for each row execute function private.notify_new_direct_message();

drop function public.get_my_notifications();

create function public.get_my_notifications()
returns table (
  notification_id bigint,
  actor_id uuid,
  actor_display_name text,
  actor_username text,
  actor_avatar_path text,
  kind text,
  created_at timestamptz,
  read_at timestamptz,
  conversation_id uuid
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
    raise exception 'You must be signed in to view notifications.';
  end if;

  return query
  select n.id, p.id, p.display_name, p.username, p.avatar_path, n.kind,
         n.created_at, n.read_at, n.conversation_id
  from public.notifications n
  join public.profiles p on p.id = n.actor_id
  where n.recipient_id = actor
  order by n.created_at desc, n.id desc
  limit 50;
end;
$$;

revoke all on function public.get_my_notifications() from public, anon;
grant execute on function public.get_my_notifications() to authenticated;

notify pgrst, 'reload schema';
commit;
