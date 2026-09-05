import fs from 'fs'
import path from 'path'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

export function run() {
  const route = fs.readFileSync(path.resolve(__dirname, '../routes/account.route.ts'), 'utf8')
  const service = fs.readFileSync(path.resolve(__dirname, '../services/account.service.ts'), 'utf8')
  const migration = fs.readFileSync(path.resolve(__dirname, '../../../../supabase/migrations/20260906030000_add_profile_display_name.sql'), 'utf8')

  assert(route.includes("router.patch('/profile'"), 'Profile update route must exist')
  assert(service.includes(".eq('id', auth.userId)"), 'Profile reads and writes must use verified identity')
  assert(service.includes('display_name'), 'Profile service must support display names')
  assert(migration.includes('display_name text'), 'Profile display name must be stored in the profile table')
  assert(migration.includes('auth.uid()'), 'Profile update policy must use auth.uid()')
  assert(migration.includes('grant update on public.profiles to authenticated'), 'Profile updates must be granted only to authenticated users')

  console.log('[PASS] account profile ownership contract')
}

if (require.main === module) run()
