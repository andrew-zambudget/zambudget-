do $$
begin
  if to_regclass('public.profiles') is not null then
    alter table public.profiles
      drop constraint if exists profiles_id_fkey;

    alter table public.profiles
      add constraint profiles_id_fkey
      foreign key (id)
      references auth.users(id)
      on delete cascade;

    execute 'comment on constraint profiles_id_fkey on public.profiles is '
      || quote_literal('Legacy account profile rows are app-owned account records and must be removed when the Supabase auth identity is deleted.');
  end if;
end $$;
