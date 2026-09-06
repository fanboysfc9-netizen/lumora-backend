import { isInternalPromptLeak } from '../services/prompt-output-guard'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

export function run() {
  console.log('[TEST] prompt output guard')
  assert(isInternalPromptLeak('You are a friendly, patient tutor who explains concepts step-by-step.'), 'Tutor system instructions must be detected')
  assert(isInternalPromptLeak('Answer user questions as a friendly, student-focused tutor.'), 'Instruction-shaped tutor output must be detected')
  assert(!isInternalPromptLeak('Build a learning plan by choosing a subject and setting a weekly goal.'), 'User-facing learning-plan content must remain allowed')
  assert(!isInternalPromptLeak('A Python variable is a name that refers to a value.'), 'Normal answers must remain allowed')
  console.log('[PASS] prompt output guard')
}

if (require.main === module) {
  try { run() } catch (error) { console.error('[FAIL] prompt output guard', error); process.exit(1) }
}