import fs from 'fs'
import path from 'path'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

export function run() {
  const chatRoute = fs.readFileSync(path.resolve(__dirname, '../routes/chat.route.ts'), 'utf8')
  const coreRoute = fs.readFileSync(path.resolve(__dirname, '../routes/lumora-core.route.ts'), 'utf8')
  const cognitaService = fs.readFileSync(path.resolve(__dirname, '../services/cognita.service.ts'), 'utf8')
  const frontend = fs.readFileSync(path.resolve(__dirname, '../../../web/app/page.tsx'), 'utf8')

  assert(chatRoute.includes('type PublicChatResponse'), 'Chat must define a public response DTO')
  assert(chatRoute.includes('answer:'), 'Public chat response must expose the answer field')
  assert(!chatRoute.includes('...result'), 'Chat route must not spread internal service results')
  assert(!coreRoute.includes('prompt: prompt.prompt'), 'Prompt builder route must not return generated prompts')
  assert(!cognitaService.includes('return { mode, raw:'), 'Cognita must not return raw provider payloads')
  assert(!frontend.includes('JSON.stringify(data.formatted)'), 'Frontend must not stringify internal response objects')
  assert(frontend.includes("typeof data.answer === 'string'"), 'Frontend must render only the public answer field')

  console.log('[PASS] prompt leak boundary contract')
}

if (require.main === module) run()