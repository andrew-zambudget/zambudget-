alter table if exists public.buddy_cloud_browser_access
  add column if not exists sync_slot_hash text;

comment on column public.buddy_cloud_browser_access.sync_slot_hash is
  'Optional link to an existing opaque Buddy Cloud sync slot hash. This duplicates the privacy-minimal sync slot hash already used for Free Tier sync-slot accounting; it is not a device name, user agent, IP address, location, or readable budget data.';

comment on table public.buddy_cloud_browser_access is
  'Privacy-minimal BudgetBuddy browser access registry for Account > Devices. Stores opaque browser hashes, optional existing sync slot hash links, and timestamps only; no device names, user agents, IP-derived locations, or readable budget data.';
