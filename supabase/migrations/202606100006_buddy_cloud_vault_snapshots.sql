create table if not exists public.buddy_cloud_vault_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_id uuid not null,
  vault_name text not null default 'primary',
  schema_version integer not null default 1,
  encryption_version integer not null default 1,
  payload jsonb not null,
  payload_checksum text,
  client_updated_at timestamptz not null,
  snapshot_reason text,
  created_at timestamptz not null default now(),
  primary key (user_id, snapshot_id)
);

create index if not exists buddy_cloud_vault_snapshots_user_vault_created_idx
  on public.buddy_cloud_vault_snapshots (user_id, vault_name, created_at desc);

alter table public.buddy_cloud_vault_snapshots enable row level security;

drop policy if exists "Users can read own Buddy Cloud vault snapshots" on public.buddy_cloud_vault_snapshots;
create policy "Users can read own Buddy Cloud vault snapshots"
  on public.buddy_cloud_vault_snapshots
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own Buddy Cloud vault snapshots" on public.buddy_cloud_vault_snapshots;
create policy "Users can insert own Buddy Cloud vault snapshots"
  on public.buddy_cloud_vault_snapshots
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own Buddy Cloud vault snapshots" on public.buddy_cloud_vault_snapshots;
create policy "Users can delete own Buddy Cloud vault snapshots"
  on public.buddy_cloud_vault_snapshots
  for delete
  to authenticated
  using (auth.uid() = user_id);

comment on table public.buddy_cloud_vault_snapshots is
  'Encrypted Buddy Cloud vault version history snapshots. Payloads are encrypted client-side before storage.';
