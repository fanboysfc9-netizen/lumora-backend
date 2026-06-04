import { CognitiveState, LearningProfile, BehaviorSummary } from './types'
import { clamp } from './scoringSystem'

export function estimateCognitiveState(profile: LearningProfile, behavior: BehaviorSummary): CognitiveState {
  const baseConfusion = clamp(profile.confusionScore || 0)
  const confusionLevel = clamp(baseConfusion + (behavior.confusionDelta || 0))

  const baseConfidence = clamp(profile.confidenceScore || 0)
  const confidenceLevel = clamp(baseConfidence - confusionLevel * 0.6 + (behavior.quickUnderstandingSignal || 0) * 0.2)

  const engagementLevel = clamp(profile.engagementScore + (behavior.engagementDelta || 0) - (behavior.boredomSignal || 0))

  // overload risk increases when messages are long + confusion is high
  const overloadRisk = clamp((behavior.avgMessageLength || 0) / 400 + confusionLevel * 0.3)

  const challengeReadiness = clamp(confidenceLevel * (1 - confusionLevel) * engagementLevel)

  return {
    confusionLevel,
    confidenceLevel,
    overloadRisk,
    engagementLevel,
    challengeReadiness
  }
}
