import fs from 'fs'
import path from 'path'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8')
}

export function run() {
  const chatRoute = read('../routes/chat.route.ts')
  const chatService = read('../services/supabase-chat.service.ts')
  const accountRoute = read('../routes/account.route.ts')
  const adminService = read('../services/supabase-admin.service.ts')
  const cognitaService = read('../services/cognita.service.ts')
  const frontend = fs.readFileSync(path.resolve(__dirname, '../../../web/app/page.tsx'), 'utf8')
  const termsMigration = fs.readFileSync(path.resolve(__dirname, '../../../../supabase/migrations/20260906000000_add_terms_acceptance.sql'), 'utf8')
  const termsEnforcementMigration = fs.readFileSync(path.resolve(__dirname, '../../../../supabase/migrations/20260906020000_enforce_terms_acceptance.sql'), 'utf8')
  const relationshipMigration = fs.readFileSync(path.resolve(__dirname, '../../../../supabase/migrations/20260906010000_harden_owned_relationships.sql'), 'utf8')

  assert(chatRoute.includes('createOptionalSupabaseAuthMiddleware'), 'Chat must allow anonymous requests through optional auth')
  assert(chatRoute.includes('supabaseChatService.persistExchange'), 'Authenticated chat must use Supabase persistence')
  assert(chatRoute.includes('if (!userId) return res.json'), 'Anonymous chat must return without persistent storage')
  assert(chatService.includes(".eq('user_id', auth.userId)"), 'Chat reads must scope rows to verified user identity')
  assert(chatService.includes('conversation not found'), 'Chat conversation access must fail closed')
  assert(accountRoute.includes('router.delete'), 'Account deletion route must exist')
  assert(accountRoute.includes('supabaseAdminService.deleteAuthUser'), 'Account deletion must use server-side Auth admin operation')
  assert(adminService.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Service-role key must remain server-only')
  assert(cognitaService.includes('if (userId) try'), 'Anonymous requests must not access adaptive user state')
  assert(!frontend.includes("localStorage.setItem('lumora_anonymous_messages'"), 'Anonymous messages must not be persisted in browser storage')
  assert(termsMigration.includes('terms_accepted_at'), 'Terms acceptance must be recorded')
  assert(termsEnforcementMigration.includes('terms acceptance required'), 'Terms acceptance must be enforced by the database trigger')
  assert(relationshipMigration.includes('c.id = conversation_id and c.user_id = auth.uid()'), 'Message ownership must be inherited from conversations')
  assert(relationshipMigration.includes('study plan project ownership mismatch'), 'Study plan project ownership must be enforced')

  console.log('[PASS] Supabase security boundary contract')
}

if (require.main === module) run()
