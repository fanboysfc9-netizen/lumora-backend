import { routeQuery } from '../knowledgeRouter'

function assert(cond: boolean, msg?: string) {
  if (!cond) throw new Error(msg || 'Assertion failed')
}

export async function run() {
  console.log('[TEST] knowledgeRouter')

  const res1 = await routeQuery('latest ai news and breakthroughs')
  assert((res1.webConfidenceScore || 0) > 0.75, 'Expected latest news to require web context')
  console.log('[PASS] knowledgeRouter - news trigger')

  const res2 = await routeQuery('2 + 2')
  assert(res2.useSerpAPI === false, 'Expected SerpAPI not to be triggered for simple math')
  console.log('[PASS] knowledgeRouter - math no-trigger')

  const res3 = await routeQuery('whos r9')
  assert(res3.intent === 'person_lookup', 'Expected apostrophe-free "whos" to be treated as a lookup')
  assert((res3.webConfidenceScore || 0) > 0.75, 'Expected short ambiguous aliases to require web context')
  console.log('[PASS] knowledgeRouter - short alias lookup trigger')
}
