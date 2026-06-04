import { normalizeInput, detectIntent, extractSubjectHints } from '../input.normalizer'
import { buildPromptForApi } from '../core.engine'

function assert(cond: boolean, msg?: string) {
  if (!cond) throw new Error(msg || 'Assertion failed')
}

export function run() {
  console.log('[TEST] lumora-core')

  const inp = 'What is photosynthesis?'
  const norm = normalizeInput(inp)
  assert(norm.intent === 'question' || norm.intent === 'explanation', 'Intent should be question/explanation')
  const subjects = extractSubjectHints(norm.cleaned)
  // expect biology to be suggested
  assert(Array.isArray(subjects), 'subjects should be array')

  const pkg = buildPromptForApi({ question: 'Explain Newton\'s second law', userLevel: 'average' })
  assert(!!pkg && !!pkg.prompt && typeof pkg.prompt === 'string', 'Prompt package should contain prompt string')

  console.log('[PASS] lumora-core')
}
