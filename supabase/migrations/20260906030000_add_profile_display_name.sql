alter table public.profiles
  add column if not exists display_name text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.raw_user_meta_data->>'terms_accepted' <> 'true' then
    raise exception 'terms acceptance required';
  end if;

  insert into public.profiles (id, display_name, terms_accepted_at)
  values (new.id, nullif(trim(new.raw_user_meta_data->>'display_name'), ''), now())
  on conflict (id) do update
    set display_name = coalesce(public.profiles.display_name, excluded.display_name),
        terms_accepted_at = coalesce(public.profiles.terms_accepted_at, excluded.terms_accepted_at);
  return new;
end;
$$;

alter table public.profiles enable row level security;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

grant update on public.profiles to authenticated;
