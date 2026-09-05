create or replace function public.enforce_study_plan_project_owner()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.project_id is not null and not exists (
    select 1 from public.projects p
    where p.id = new.project_id and p.user_id = new.user_id
  ) then
    raise exception 'study plan project ownership mismatch';
  end if;
  return new;
end;
$$;

drop trigger if exists study_plans_project_owner on public.study_plans;
create trigger study_plans_project_owner
before insert or update of project_id, user_id on public.study_plans
for each row execute function public.enforce_study_plan_project_owner();

alter table public.messages enable row level security;
drop policy if exists messages_is_owner on public.messages;
create policy messages_is_owner on public.messages
for all to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.user_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.user_id = auth.uid()
  )
);

create index if not exists messages_conversation_created_idx
  on public.messages(conversation_id, created_at);
