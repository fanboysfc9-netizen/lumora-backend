import { processInteractionOutcome } from '../feedbackLoop'
import { getOrCreateProfile } from '../learningProfile'
import memoryService from '../../memory/memory.service'

function assert(cond: boolean, msg?: string) {
  if (!cond) throw new Error(msg || 'Assertion failed')
}

export async function run() {
  console.log('[TEST] feedbackLoop')
  const userId = `unit-feedback-${Date.now()}`

  // ensure profile exists
  await getOrCreateProfile(userId)

  // simulate confusion messages
  await memoryService.addUserMessage(userId, undefined, "I still don't understand this concept", 'standard')
  await memoryService.addUserMessage(userId, undefined, "Can you explain step-by-step? I still don't get it", 'standard')

  const res = await processInteractionOutcome(userId, undefined, { test: true })
  const updated = await memoryService.getUserProfile(userId)

  assert(updated && Array.isArray(updated.adaptationHistory) && updated.adaptationHistory.length > 0, 'adaptationHistory should be appended')

  console.log('[PASS] feedbackLoop')
}
