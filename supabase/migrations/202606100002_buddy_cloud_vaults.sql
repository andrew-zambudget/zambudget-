create table if not exists public.buddy_cloud_vaults (
  user_id uuid not null references auth.users(id) on delete cascade,
  vault_name text not null default 'primary',
  schema_version integer not null default 1,
  encryption_version integer not null default 1,
  payload jsonb not null,
  payload_checksum text,
  client_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, vault_name)
);

alter table public.buddy_cloud_vaults enable row level security;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop policy if exists "Users can read own Buddy Cloud vaults" on public.buddy_cloud_vaults;
create policy "Users can read own Buddy Cloud vaults"
  on public.buddy_cloud_vaults
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own Buddy Cloud vaults" on public.buddy_cloud_vaults;
create policy "Users can insert own Buddy Cloud vaults"
  on public.buddy_cloud_vaults
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own Buddy Cloud vaults" on public.buddy_cloud_vaults;
create policy "Users can update own Buddy Cloud vaults"
  on public.buddy_cloud_vaults
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own Buddy Cloud vaults" on public.buddy_cloud_vaults;
create policy "Users can delete own Buddy Cloud vaults"
  on public.buddy_cloud_vaults
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop trigger if exists touch_buddy_cloud_vaults_updated_at on public.buddy_cloud_vaults;
create trigger touch_buddy_cloud_vaults_updated_at
  before update on public.buddy_cloud_vaults
  for each row
  execute function public.touch_updated_at();
