create table if not exists public.billing_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status text not null default 'inactive',
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.billing_profiles enable row level security;

create policy "Users can read own billing profile"
  on public.billing_profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_billing_profiles_updated_at on public.billing_profiles;
create trigger touch_billing_profiles_updated_at
  before update on public.billing_profiles
  for each row
  execute function public.touch_updated_at();
