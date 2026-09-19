import fs from 'fs'
import path from 'path'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

export function run() {
  const route = fs.readFileSync(path.resolve(__dirname, '../routes/practice.route.ts'), 'utf8')
  const service = fs.readFileSync(path.resolve(__dirname, '../services/practice.service.ts'), 'utf8')
  assert(route.includes('authenticateSupabaseRequest'), 'Practice must require authentication')
  assert(route.includes('study plan required'), 'Practice must require a study plan')
  assert(service.includes('fetchSerpResults'), 'Practice must use server-side SerpAPI search')
  assert(service.includes('getStudyPlan'), 'Practice must load the owned study plan')
  assert(service.includes('topicNames'), 'Practice must derive questions from plan topics')
  console.log('[PASS] practice route contract')
}

if (require.main === module) run()
