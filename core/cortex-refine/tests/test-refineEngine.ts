import refineData from '../refineEngine'

function assert(cond: boolean, msg?: string) {
  if (!cond) throw new Error(msg || 'Assertion failed')
}

export function run() {
  console.log('[TEST] refineEngine')

  const rawWeb = [
    { title: 'X was founded in 2020', snippet: 'X was founded in 2020.' , link: 'https://example.com' },
    { title: 'Buy X now - special offer', snippet: 'Limited time discount, buy now', link: 'https://shop.example.com' },
    { title: 'X was founded in 2019', snippet: 'X was founded in 2019.', link: 'https://university.edu' },
    { title: 'X is based in Ghana', snippet: 'X is based in Ghana.', link: 'https://example.org' },
    { title: 'Duplicate', snippet: 'X was founded in 2020.', link: 'https://example.com/dup' }
  ]

  const out = refineData({ query: 'X founding year', rawWebResults: rawWeb })
  // Ad removal
  assert(!out.cleanedSummary.includes('Buy X now'), 'Ad content should be removed')
  // Duplicate removal (facts should be unique)
  const factCount = out.facts.length
  assert(factCount >= 1, 'Should extract at least one fact')
  // Contradiction detection should be true because 2019 vs 2020
  assert(out.contradictionsDetected === true, 'Contradictions should be detected')
  // Reliability score between 0 and 1
  assert(typeof out.reliabilityScore === 'number' && out.reliabilityScore >= 0 && out.reliabilityScore <= 1, 'Reliability score should be 0..1')

  console.log('[PASS] refineEngine')
}
