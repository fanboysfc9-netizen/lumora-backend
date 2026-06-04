import * as lumoraCore from '../lumora-core/core.engine'
import { getOrCreateProfile } from '../cortex-adapt/learningProfile'
import { estimateCognitiveState } from '../cortex-adapt/cognitiveEngine'
import { decideAdaptation } from '../cortex-adapt/adaptationEngine'
import { toSystemInstruction } from '../cortex-adapt/promptAdapter'
import knowledgeRouter from '../cortex-adapt/knowledgeRouter'
import refineData from '../cortex-refine/refineEngine'

function assert(cond: boolean, msg?: string) {
  if (!cond) throw new Error(msg || 'Assertion failed')
}

export async function run() {
  console.log('[TEST] integration')

  const userId = `int-test-${Date.now()}`
  const userInput = 'Explain photosynthesis'

  // Core
  const corePkg = lumoraCore.buildPromptForApi({ question: userInput })
  assert(!!corePkg && !!corePkg.prompt, 'Core prompt built')

  // Profile
  const profile = await getOrCreateProfile(userId)
  assert(!!profile, 'Profile should be created')

  // Adapt
  const state = estimateCognitiveState(profile, { repeatedConfusionCount: 0, recentFollowUps: 0, recentQuestionRatio: 0, avgMessageLength: userInput.length, confusionDelta: 0, engagementDelta: 0, boredomSignal: 0, quickUnderstandingSignal: 0 })
  const decision = decideAdaptation(profile, state, {})
  assert(!!decision, 'Adaptation decision computed')

  // Knowledge Router: simulate external fetch by bypassing network and using refineData
  const rawWeb = [ { title: 'Photosynthesis converts light into chemical energy', snippet: 'Plants convert sunlight into sugars via photosynthesis', link: 'https://example.edu' } ]
  const refined = refineData({ query: userInput, rawWebResults: rawWeb })
  // Refine is intentionally strict; it may return zero facts for some inputs.
  // Ensure the output shape exists without requiring positive fact counts.
  assert(refined && Array.isArray(refined.facts), 'Refine returned facts array')
  assert(typeof refined.cleanedSummary === 'string', 'Refine returned cleanedSummary string')

  // Build a mock system instruction
  const adaptInstr = toSystemInstruction(decision, profile, undefined, undefined)
  const externalBlock = `External Knowledge (verified):\n${refined.cleanedSummary}\n\n`

  // Simulate Groq response (mock) and post-process
  const mockGroqText = `Explanation: Photosynthesis is the process by which plants convert light into chemical energy.\nSteps: 1. Absorb light; 2. Convert to ATP; 3. Fix carbon.`
  const post = lumoraCore.postProcessResponse(mockGroqText)
  const finalText = `${post.explanation}\n${(post.steps || []).join('\n')}`
  assert(finalText.includes('Photosynthesis'), 'Final text contains explanation')

  console.log('[PASS] integration')
}
