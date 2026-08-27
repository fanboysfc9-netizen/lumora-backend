import fs from 'fs'
import path from 'path'
import { resolveEntitlements } from '../services/entitlement.service'
import { createSupabaseAuthMiddleware } from '../middleware/supabase-auth.middleware'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

function response() {
  return {
    statusCode: 200,
    status(code: number) { this.statusCode = code; return this },
    json() { return this }
  }
}

async function runAuth(status: number, token?: string) {
  const req: any = { headers: token ? { authorization: `Bearer ${token}` } : {}, header(name: string) { return this.headers[name.toLowerCase()] } }
  const res = response()
  let continued = false
  await createSupabaseAuthMiddleware({ auth: { getUser: async () => ({ data: { user: status === 200 ? { id: 'user-a' } : null }, error: status === 200 ? null : new Error('invalid') }) } } as any)(req, res as any, () => { continued = true })
  return { res, continued, req }
}

export async function run() {
  console.log('[TEST] Phase 6C account foundation')

  const migration = fs.readFileSync(path.resolve(__dirname, '../../../../supabase/migrations/20260826000000_account_entitlement_foundation.sql'), 'utf8').toLowerCase()
  for (const table of ['profiles', 'plans', 'subscriptions', 'entitlements', 'usage_counters']) {
    assert(migration.includes(`create table if not exists public.${table}`), `Migration must define ${table}`)
    assert(migration.includes(`alter table public.${table} enable row level security`), `Migration must enable RLS for ${table}`)
  }
  assert(migration.includes('auth.uid()'), 'Migration must use auth.uid() ownership policies')
  assert(migration.includes('revoke insert, update, delete'), 'Migration must revoke client mutation authority')

  assert((await runAuth(401)).res.statusCode === 401, 'Missing token must be rejected')
  assert((await runAuth(401, 'invalid')).res.statusCode === 401, 'Invalid token must be rejected')
  const valid = await runAuth(200, 'valid')
  assert(valid.continued && valid.req.auth.userId === 'user-a', 'Valid token must attach verified identity')

  const entitlement = { feature_key: 'chat.basic', feature_value: true }
  assert(resolveEntitlements(null, { id: 'free', is_active: true }, [entitlement]).length === 0, 'Missing subscription must fail closed')
  assert(resolveEntitlements({ status: 'canceled', plan_id: 'free' }, { id: 'free', is_active: true }, [entitlement]).length === 0, 'Inactive subscription must fail closed')
  assert(resolveEntitlements({ status: 'active', plan_id: 'free' }, { id: 'free', is_active: false }, [entitlement]).length === 0, 'Inactive plan must fail closed')
  assert(resolveEntitlements({ status: 'active', plan_id: 'paid' }, { id: 'free', is_active: true }, [entitlement]).length === 0, 'Mismatched plan must fail closed')
  assert(resolveEntitlements({ status: 'active', plan_id: 'free' }, { id: 'free', is_active: true }, [entitlement]).length === 1, 'Valid active plan must resolve entitlements')

  console.log('[PASS] Phase 6C account foundation')
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch((error) => { console.error('[FAIL] Phase 6C account foundation', error); process.exit(1) })
}
