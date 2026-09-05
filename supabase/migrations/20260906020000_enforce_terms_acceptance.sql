create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.raw_user_meta_data->>'terms_accepted' <> 'true' then
    raise exception 'terms acceptance required';
  end if;

  insert into public.profiles (id, terms_accepted_at)
  values (new.id, now())
  on conflict (id) do update
    set terms_accepted_at = coalesce(public.profiles.terms_accepted_at, excluded.terms_accepted_at);
  return new;
end;
$$;
