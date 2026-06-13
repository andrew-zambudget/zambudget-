-- Harden account and legacy budget table RLS policy roles.
-- Supabase's "public" policy role includes anonymous requests. These tables
-- should only expose owner-scoped rows to signed-in users.

do $$
begin
  if to_regclass('public.categories') is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'categories'
        and column_name = 'user_id'
    ) then
      alter table public.categories enable row level security;

      drop policy if exists "Users can view own categories" on public.categories;
      create policy "Users can view own categories"
        on public.categories
        for select
        to authenticated
        using (auth.uid() = user_id);

      drop policy if exists "Users can insert own categories" on public.categories;
      create policy "Users can insert own categories"
        on public.categories
        for insert
        to authenticated
        with check (auth.uid() = user_id);

      drop policy if exists "Users can update own categories" on public.categories;
      create policy "Users can update own categories"
        on public.categories
        for update
        to authenticated
        using (auth.uid() = user_id)
        with check (auth.uid() = user_id);

      drop policy if exists "Users can delete own categories" on public.categories;
      create policy "Users can delete own categories"
        on public.categories
        for delete
        to authenticated
        using (auth.uid() = user_id);
    else
      raise notice 'Skipping public.categories RLS hardening because user_id column was not found.';
    end if;
  end if;
end $$;

do $$
begin
  if to_regclass('public.transactions') is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'transactions'
        and column_name = 'user_id'
    ) then
      alter table public.transactions enable row level security;

      drop policy if exists "Users can view own transactions" on public.transactions;
      create policy "Users can view own transactions"
        on public.transactions
        for select
        to authenticated
        using (auth.uid() = user_id);

      drop policy if exists "Users can insert own transactions" on public.transactions;
      create policy "Users can insert own transactions"
        on public.transactions
        for insert
        to authenticated
        with check (auth.uid() = user_id);

      drop policy if exists "Users can update own transactions" on public.transactions;
      create policy "Users can update own transactions"
        on public.transactions
        for update
        to authenticated
        using (auth.uid() = user_id)
        with check (auth.uid() = user_id);

      drop policy if exists "Users can delete own transactions" on public.transactions;
      create policy "Users can delete own transactions"
        on public.transactions
        for delete
        to authenticated
        using (auth.uid() = user_id);
    else
      raise notice 'Skipping public.transactions RLS hardening because user_id column was not found.';
    end if;
  end if;
end $$;

do $$
begin
  if to_regclass('public.profiles') is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'id'
    ) then
      alter table public.profiles enable row level security;

      drop policy if exists "Public profiles are viewable by owner" on public.profiles;
      create policy "Public profiles are viewable by owner"
        on public.profiles
        for select
        to authenticated
        using (auth.uid() = id);

      drop policy if exists "Users can insert their own profile" on public.profiles;
      create policy "Users can insert their own profile"
        on public.profiles
        for insert
        to authenticated
        with check (auth.uid() = id);
    else
      raise notice 'Skipping public.profiles RLS hardening because id column was not found.';
    end if;
  end if;
end $$;

do $$
begin
  if to_regclass('public.subscriptions') is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'subscriptions'
        and column_name = 'user_id'
    ) then
      alter table public.subscriptions enable row level security;

      drop policy if exists "Users can view their own subscription" on public.subscriptions;
      create policy "Users can view their own subscription"
        on public.subscriptions
        for select
        to authenticated
        using (auth.uid() = user_id);
    else
      raise notice 'Skipping public.subscriptions RLS hardening because user_id column was not found.';
    end if;
  end if;
end $$;
