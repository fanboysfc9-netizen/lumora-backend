create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  subject text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  title text not null,
  objective text not null default '',
  subject text not null default '',
  learner_level text not null default 'beginner',
  estimated_duration text not null default '',
  schedule text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_plan_topics (
  id uuid primary key default gen_random_uuid(),
  study_plan_id uuid not null references public.study_plans(id) on delete cascade,
  week_number integer not null default 1 check (week_number > 0),
  title text not null,
  lesson text not null default '',
  exercise text not null default '',
  completed boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists projects_user_updated_idx on public.projects(user_id, updated_at desc);
create index if not exists study_plans_user_updated_idx on public.study_plans(user_id, updated_at desc);
create index if not exists study_plans_project_idx on public.study_plans(project_id);
create index if not exists study_plan_topics_plan_order_idx on public.study_plan_topics(study_plan_id, week_number, sort_order);

alter table public.projects enable row level security;
alter table public.study_plans enable row level security;
alter table public.study_plan_topics enable row level security;

drop policy if exists projects_owner on public.projects;
create policy projects_owner on public.projects for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists study_plans_owner on public.study_plans;
create policy study_plans_owner on public.study_plans for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists study_plan_topics_owner on public.study_plan_topics;
create policy study_plan_topics_owner on public.study_plan_topics for all to authenticated
  using (exists (select 1 from public.study_plans p where p.id = study_plan_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.study_plans p where p.id = study_plan_id and p.user_id = auth.uid()));

create or replace function public.touch_projects_study_plans_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at before update on public.projects
for each row execute function public.touch_projects_study_plans_updated_at();

drop trigger if exists study_plans_touch_updated_at on public.study_plans;
create trigger study_plans_touch_updated_at before update on public.study_plans
for each row execute function public.touch_projects_study_plans_updated_at();