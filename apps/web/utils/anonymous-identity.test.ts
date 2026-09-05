import fs from 'fs'
import path from 'path'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

export function run() {
  const page = fs.readFileSync(path.resolve(__dirname, '../app/page.tsx'), 'utf8')
  assert(page.includes('<span>Guest</span>'), 'Anonymous UI must show Guest')
  assert(!page.includes('<span>Yaw</span>'), 'Anonymous UI must not show a personal name')
  assert(page.includes('{session && <div className="conversation-history">'), 'Persistent chat history must require a session')
  console.log('[PASS] anonymous identity contract')
}

if (require.main === module) run()