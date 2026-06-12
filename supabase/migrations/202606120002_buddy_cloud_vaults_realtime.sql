do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.buddy_cloud_vaults;
  end if;
exception
  when duplicate_object then null;
end $$;
