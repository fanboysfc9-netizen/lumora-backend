import fs from 'fs'
import path from 'path'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

export function run() {
  const route = fs.readFileSync(path.resolve(__dirname, '../routes/wikipedia.route.ts'), 'utf8')
  const index = fs.readFileSync(path.resolve(__dirname, '../index.ts'), 'utf8')
  const chat = fs.readFileSync(path.resolve(__dirname, '../routes/chat.route.ts'), 'utf8')
  const cognita = fs.readFileSync(path.resolve(__dirname, '../services/cognita.service.ts'), 'utf8')
  assert(route.includes('site:en.wikipedia.org'), 'Wikipedia queries must be scoped to English Wikipedia')
  assert(route.includes('fetchSerpResults'), 'Wikipedia must use server-side SerpAPI search')
  assert(route.includes('api.php') && route.includes('prop: \'extracts\''), 'Article results must load readable Wikipedia article text')
  assert(route.includes("hostname.toLowerCase() === 'en.wikipedia.org'"), 'Article sources must be restricted to English Wikipedia')
  assert(route.includes('Article search is not configured.'), 'Missing SerpAPI configuration must be reported')
  assert(index.includes("app.use('/api/wikipedia'"), 'Wikipedia route must be registered')
  assert(chat.includes('conversationHistory'), 'Chat must load persisted conversation memory')
  assert(cognita.includes('Recent conversation memory'), 'Cognita must use recent conversation memory')
  console.log('[PASS] Wikipedia and conversation memory contract')
}

if (require.main === module) run()
