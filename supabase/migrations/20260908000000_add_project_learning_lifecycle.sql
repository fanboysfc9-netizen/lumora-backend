alter table public.projects
  add column if not exists goal text not null default '',
  add column if not exists deadline date,
  add column if not exists status text not null default 'active',
  add column if not exists progress_percent integer not null default 0;

alter table public.projects
drop constraint if exists projects_status_check;

alter table public.projects
add constraint projects_status_check check (status in ('active', 'completed', 'archived'));

alter table public.projects
drop constraint if exists projects_progress_percent_check;

alter table public.projects
add constraint projects_progress_percent_check check (progress_percent between 0 and 100);

create index if not exists projects_user_status_idx on public.projects(user_id, status, updated_at desc);
