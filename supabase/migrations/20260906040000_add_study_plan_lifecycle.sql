alter table public.study_plans
  add column if not exists available_time text not null default '',
  add column if not exists deadline date,
  add column if not exists status text not null default 'active';

alter table public.study_plans
  drop constraint if exists study_plans_status_check;
alter table public.study_plans
  add constraint study_plans_status_check check (status in ('active', 'completed', 'archived'));

alter table public.study_plan_topics
  add column if not exists status text not null default 'not_started',
  add column if not exists completed_at timestamptz;

alter table public.study_plan_topics
  drop constraint if exists study_plan_topics_status_check;
alter table public.study_plan_topics
  add constraint study_plan_topics_status_check check (status in ('not_started', 'in_progress', 'completed'));

update public.study_plan_topics
set status = case when completed then 'completed' else 'not_started' end
where status = 'not_started';

create index if not exists study_plans_user_status_idx on public.study_plans(user_id, status, updated_at desc);
