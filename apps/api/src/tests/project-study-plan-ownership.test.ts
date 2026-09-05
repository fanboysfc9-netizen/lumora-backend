import fs from 'fs'
import path from 'path'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

export function run() {
  const migration = fs.readFileSync(path.resolve(__dirname, '../../../../supabase/migrations/20260905000000_create_projects_study_plans.sql'), 'utf8').toLowerCase()
  for (const table of ['projects', 'study_plans', 'study_plan_topics']) {
    assert(migration.includes(`create table if not exists public.${table}`), `Migration must define ${table}`)
    assert(migration.includes(`alter table public.${table} enable row level security`), `RLS must be enabled for ${table}`)
  }
  assert(migration.includes('user_id uuid not null references auth.users(id) on delete cascade'), 'User-owned records must cascade from auth.users')
  assert(migration.includes('project_id uuid references public.projects(id) on delete cascade'), 'Plans must cascade from projects')
  assert(migration.includes('study_plan_id uuid not null references public.study_plans(id) on delete cascade'), 'Topics must cascade from plans')
  assert(migration.includes('auth.uid() = user_id'), 'Project and plan policies must scope to auth.uid()')
  assert(migration.includes('where p.id = study_plan_id and p.user_id = auth.uid()'), 'Topic policy must inherit plan ownership')
  assert(migration.includes('project_id uuid references public.projects(id) on delete cascade'), 'Plans must retain project ownership relationship')
  console.log('[PASS] project and study-plan ownership contract')
}

if (require.main === module) run()
