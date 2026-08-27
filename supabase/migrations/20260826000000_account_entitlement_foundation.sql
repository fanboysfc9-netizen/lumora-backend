create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  display_name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  status text not null check (status in ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists subscriptions_one_current_per_user
  on public.subscriptions(user_id)
  where status in ('trialing', 'active', 'past_due');
create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  feature_key text not null,
  feature_value jsonb not null default 'true'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(plan_id, feature_key)
);

create table if not exists public.usage_counters (
  user_id uuid not null references public.profiles(id) on delete cascade,
  period_start date not null,
  request_count integer not null default 0 check (request_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, period_start)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into public.plans (name, display_name, description)
values ('free', 'Free', 'Default development plan')
on conflict (name) do nothing;

insert into public.entitlements (plan_id, feature_key, feature_value)
select id, 'chat.basic', 'true'::jsonb from public.plans where name = 'free'
on conflict (plan_id, feature_key) do nothing;

create or replace trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();
create or replace trigger plans_set_updated_at
before update on public.plans
for each row execute procedure public.set_updated_at();
create or replace trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute procedure public.set_updated_at();
create or replace trigger entitlements_set_updated_at
before update on public.entitlements
for each row execute procedure public.set_updated_at();
create or replace trigger usage_counters_set_updated_at
before update on public.usage_counters
for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.entitlements enable row level security;
alter table public.usage_counters enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select to authenticated using (id = auth.uid());

drop policy if exists plans_select_active on public.plans;
create policy plans_select_active on public.plans
for select to authenticated using (is_active = true);

drop policy if exists entitlements_select_active_plan on public.entitlements;
create policy entitlements_select_active_plan on public.entitlements
for select to authenticated using (
  exists (select 1 from public.plans p where p.id = plan_id and p.is_active = true)
);

drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions
for select to authenticated using (user_id = auth.uid());

drop policy if exists usage_counters_select_own on public.usage_counters;
create policy usage_counters_select_own on public.usage_counters
for select to authenticated using (user_id = auth.uid());

revoke insert, update, delete on public.profiles from anon, authenticated;
revoke insert, update, delete on public.plans from anon, authenticated;
revoke insert, update, delete on public.subscriptions from anon, authenticated;
revoke insert, update, delete on public.entitlements from anon, authenticated;
revoke insert, update, delete on public.usage_counters from anon, authenticated;
revoke all on public.profiles, public.plans, public.subscriptions, public.entitlements, public.usage_counters from anon;
 grant select on public.profiles, public.plans, public.subscriptions, public.entitlements, public.usage_counters to authenticated;
