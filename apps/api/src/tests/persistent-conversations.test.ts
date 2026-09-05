import fs from 'fs'
import path from 'path'
import { titleFromMessage } from '../services/supabase-chat.service'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

export function run() {
  const service = fs.readFileSync(path.resolve(__dirname, '../services/supabase-chat.service.ts'), 'utf8')
  const route = fs.readFileSync(path.resolve(__dirname, '../routes/chat.route.ts'), 'utf8')
  const migration = fs.readFileSync(path.resolve(__dirname, '../../../../supabase/migrations/20260715000100_reconcile_supabase_schema.sql'), 'utf8')

  assert(titleFromMessage('Teach me Python variables') === 'Python Variables', 'Title should use the first meaningful message')
  assert(titleFromMessage('What is photosynthesis?') === 'What Is Photosynthesis', 'Title should be concise and trimmed')
  assert(titleFromMessage('x'.repeat(80)).length <= 60, 'Title must be length limited')
  assert(service.includes(".eq('user_id', auth.userId)"), 'Conversation operations must scope to verified ownership')
  assert(service.includes(".eq('id', conversationId)"), 'Conversation references must be checked by ID')
  assert(service.includes('.delete()'), 'Conversation deletion must exist')
  assert(route.includes("router.get('/conversations'"), 'Conversation listing route must exist')
  assert(route.includes("router.patch('/conversations/:conversationId'"), 'Conversation rename route must exist')
  assert(route.includes("router.delete('/conversations/:conversationId'"), 'Conversation delete route must exist')
  assert(migration.includes('messages'), 'Existing conversations/messages schema must be reused')

  console.log('[PASS] persistent conversations contract')
}

if (require.main === module) run()
