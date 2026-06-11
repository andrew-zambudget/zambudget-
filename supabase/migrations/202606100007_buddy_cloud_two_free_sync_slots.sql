alter table if exists public.buddy_cloud_vaults
  add column if not exists sync_owner_slots jsonb not null default '[]'::jsonb;

comment on column public.buddy_cloud_vaults.sync_owner_slots is
  'Privacy-minimal Free Tier Buddy Cloud sync slots. Stores up to two opaque SHA-256 sync slot hashes plus timestamps only; no device names, user agents, IP addresses, locations, or readable budget data.';

update public.buddy_cloud_vaults
set sync_owner_slots = jsonb_build_array(jsonb_build_object(
  'hash', sync_owner_hash,
  'claimed_at', sync_owner_claimed_at,
  'last_seen_at', sync_owner_last_seen_at
))
where sync_owner_hash is not null
  and sync_owner_slots = '[]'::jsonb;
