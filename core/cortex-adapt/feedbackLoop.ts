import { getOrCreateProfile, updateProfile } from './learningProfile'
import { analyzeConversation } from './behaviorAnalyzer'
import { estimateCognitiveState } from './cognitiveEngine'
import { decideAdaptation } from './adaptationEngine'
import { recordAdaptationEvent } from './memoryEngine'
import { AdaptationEvent } from './types'
import { movingAverage, normalizeDepth, clamp, conservativeBlend } from './scoringSystem'
import globalEngine from './globalEngine'
import ruleEvolution from './ruleEvolution'

/**
 * Process the outcome of an interaction and record adaptation events.
 * This is intentionally lightweight and conservative: it records compact,
 * educationally-meaningful events and updates the profile via the memory layer.
 */
export async function processInteractionOutcome(userId: string, conversationId?: string, context?: any) {
  const profile = await getOrCreateProfile(userId)
  const behavior = await analyzeConversation(userId, conversationId)
  const state = estimateCognitiveState(profile, behavior)

  const decision = decideAdaptation(profile, state, context)

  const event: AdaptationEvent = {
    timestamp: Date.now(),
    reason: 'auto-eval-after-interaction',
    delta: {
      confidenceScore: state.confidenceLevel - (profile.confidenceScore || 0),
      confusionScore: state.confusionLevel - (profile.confusionScore || 0),
      engagementScore: state.engagementLevel - (profile.engagementScore || 0)
    },
    decision,
    outcome: 'unknown'
  }

  await recordAdaptationEvent(userId, event)

  // Gradually update profile scores based on estimated cognitive state.
  try {
    // Conservative blend per-user: new = old*0.9 + observed*0.1, capped per update
    const patch: any = {
      confidenceScore: clamp(conservativeBlend(profile.confidenceScore || 0, state.confidenceLevel || 0, 0.1)),
      confusionScore: clamp(conservativeBlend(profile.confusionScore || 0, state.confusionLevel || 0, 0.1)),
      engagementScore: clamp(conservativeBlend(profile.engagementScore || 0, state.engagementLevel || 0, 0.1))
    }

    // Gentle adjustments to explanation depth preference
    if (typeof profile.preferredExplanationDepth === 'number') {
      patch.preferredExplanationDepth = conservativeBlend(profile.preferredExplanationDepth || 0.6, decision.explanationDepth || 0.5, 0.1)
    } else {
      patch.preferredExplanationDepth = normalizeDepth(decision.explanationDepth || 0.5)
    }

    // Nudge needsFrequentExamples when example density is high
    if (decision.exampleDensity >= 0.7) patch.needsFrequentExamples = true

    // Conservative pacing updates: only change pacing when confusion is high or challenge is explicit
    if (decision.pacing && decision.pacing !== profile.pacingPreference) {
      if (state.confusionLevel > 0.6 && decision.pacing === 'slow') patch.pacingPreference = 'slow'
      if (decision.teachingMode === 'challenge_mode' && state.confidenceLevel > 0.7) patch.pacingPreference = 'fast'
    }

    await updateProfile(userId, patch)
  } catch (e) {
    // never throw — feedback loop must be fail-safe
    console.warn('[Cortex] profile update failed (non-fatal):', (e as any)?.message || String(e))
  }

  // Update global statistics and apply rule evolution conservatively
    try {
      const success = (state.confidenceLevel > (profile.confidenceScore || 0.5))
      await globalEngine.recordInteraction({
        userId,
        subject: context && context.subject,
        decision,
        success,
        confusionLevel: state.confusionLevel,
        confidenceLevel: state.confidenceLevel,
        timestamp: Date.now()
      })
      // run rule evolution asynchronously but await to ensure persistence (safe and light)
      await ruleEvolution.applyRuleEvolution()
    } catch (e) {
      console.warn('[Cortex] global stats update / rule evolution failed (non-fatal):', (e as any)?.message || String(e))
    }

  return { profile, behavior, state, decision }
}
