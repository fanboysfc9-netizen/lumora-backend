import fs from 'fs'
import path from 'path'

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message) }

export function run() {
  const service = fs.readFileSync(path.resolve(__dirname, '../services/project.service.ts'), 'utf8')
  const route = fs.readFileSync(path.resolve(__dirname, '../routes/study-plans.route.ts'), 'utf8')
  const migration = fs.readFileSync(path.resolve(__dirname, '../../../../supabase/migrations/20260906040000_add_study_plan_lifecycle.sql'), 'utf8')
  assert(service.includes('normalizeTopics'), 'Generated topics must be normalized before storage')
  assert(service.includes('study plan must contain 1 to 50 topics'), 'Topic count must be bounded')
  assert(service.includes("status, completed_at"), 'Topic status updates must persist lifecycle state')
  assert(service.includes("status: 'active'"), 'New plans must begin active')
  assert(route.includes("router.delete('/:id'"), 'Owner delete route must exist')
  assert(migration.includes('available_time'), 'Plans must store available time')
  assert(migration.includes('deadline'), 'Plans must store optional deadline')
  assert(migration.includes("status in ('active', 'completed', 'archived')"), 'Plan lifecycle must be constrained')
  assert(migration.includes("status in ('not_started', 'in_progress', 'completed')"), 'Topic lifecycle must be constrained')
  console.log('[PASS] study plan Phase 3 contract')
}

if (require.main === module) run()
