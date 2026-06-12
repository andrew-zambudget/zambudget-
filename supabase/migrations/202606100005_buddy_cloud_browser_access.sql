create table if not exists public.buddy_cloud_browser_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  browser_hash text not null,
  sync_slot_hash text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by_hash text,
  primary key (user_id, browser_hash)
);

alter table public.buddy_cloud_browser_access enable row level security;

comment on table public.buddy_cloud_browser_access is
  'Privacy-minimal BudgetBuddy browser access registry for Account > Devices. Stores opaque browser hashes, optional existing sync slot hash links, and timestamps only; no device names, user agents, IP-derived locations, or readable budget data.';

comment on column public.buddy_cloud_browser_access.browser_hash is
  'Opaque SHA-256 hash of a locally generated browser access token.';

comment on column public.buddy_cloud_browser_access.sync_slot_hash is
  'Optional link to an existing opaque Buddy Cloud sync slot hash. This duplicates the privacy-minimal sync slot hash already used for Free Tier sync-slot accounting; it is not a device name, user agent, IP address, location, or readable budget data.';

drop policy if exists "Users can read own Buddy Cloud browser access" on public.buddy_cloud_browser_access;
create policy "Users can read own Buddy Cloud browser access"
  on public.buddy_cloud_browser_access
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own Buddy Cloud browser access" on public.buddy_cloud_browser_access;
create policy "Users can insert own Buddy Cloud browser access"
  on public.buddy_cloud_browser_access
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own Buddy Cloud browser access" on public.buddy_cloud_browser_access;
create policy "Users can update own Buddy Cloud browser access"
  on public.buddy_cloud_browser_access
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.buddy_cloud_browser_access;
  end if;
exception
  when duplicate_object then null;
end $$;
