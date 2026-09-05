import fs from 'fs'
import path from 'path'
import { mapClientMode } from '../services/chat-mode'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

export function run() {
  assert(mapClientMode() === 'standard', 'Missing mode must use normal chat')
  assert(mapClientMode('nira') === 'standard', 'Nira must use the normal tutor path')
  assert(mapClientMode('elara') === 'research', 'Elara compatibility routing must remain intact')
  assert(mapClientMode('solara') === 'creative', 'Solara compatibility routing must remain intact')

  const routeSource = fs.readFileSync(path.resolve(__dirname, '../routes/chat.route.ts'), 'utf8')
  assert(routeSource.includes('message, conversationId, mode: mappedMode'), 'The original message must reach Cognita')
  assert(!routeSource.includes('Analyze a document'), 'Chat routing must not contain a document-analysis default')

  console.log('[PASS] normal chat routing contract')
}

if (require.main === module) run()