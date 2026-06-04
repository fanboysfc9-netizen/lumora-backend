import { routeQuery } from '../knowledgeRouter'

function assert(cond: boolean, msg?: string) {
  if (!cond) throw new Error(msg || 'Assertion failed')
}

export async function run() {
  console.log('[TEST] knowledgeRouter')

  const res1 = await routeQuery('latest ai news and breakthroughs')
  assert(res1.useSerpAPI === true, 'Expected SerpAPI to be triggered for latest news')
  console.log('[PASS] knowledgeRouter - news trigger')

  const res2 = await routeQuery('2 + 2')
  assert(res2.useSerpAPI === false, 'Expected SerpAPI not to be triggered for simple math')
  console.log('[PASS] knowledgeRouter - math no-trigger')
}
