alter table if exists public.buddy_cloud_vaults
  add column if not exists sync_owner_hash text,
  add column if not exists sync_owner_claimed_at timestamptz,
  add column if not exists sync_owner_last_seen_at timestamptz;

comment on column public.buddy_cloud_vaults.sync_owner_hash is
  'Legacy mirror of the primary opaque Buddy Cloud sync slot hash. Free Tier slot enforcement uses privacy-minimal sync slot hashes and timestamps only; not a device name, user agent, IP address, or location.';

comment on column public.buddy_cloud_vaults.sync_owner_claimed_at is
  'Legacy mirror timestamp for when the primary Free Tier sync slot was claimed.';

comment on column public.buddy_cloud_vaults.sync_owner_last_seen_at is
  'Server-visible timestamp for the latest verified Free Tier sync slot activity.';
