alter table public.profiles
  add column if not exists terms_accepted_at timestamptz;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, terms_accepted_at)
  values (
    new.id,
    case when new.raw_user_meta_data->>'terms_accepted' = 'true' then now() else null end
  )
  on conflict (id) do update
    set terms_accepted_at = coalesce(public.profiles.terms_accepted_at, excluded.terms_accepted_at);
  return new;
end;
$$;

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select to authenticated using (id = auth.uid());

revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
