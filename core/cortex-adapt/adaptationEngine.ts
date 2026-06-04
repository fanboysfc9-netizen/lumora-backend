import { AdaptationDecision, LearningProfile, CognitiveState, TeachingMode } from './types'
import { clamp } from './scoringSystem'

export function decideAdaptation(profile: LearningProfile, state: CognitiveState, context?: any): AdaptationDecision {
  // Base values informed by profile
  let teachingMode: TeachingMode = 'guided_breakdown'
  let explanationDepth = clamp(profile.preferredExplanationDepth)
  let pacing = profile.pacingPreference
  let exampleDensity = profile.needsFrequentExamples ? 0.7 : 0.4
  let challengeLevel = 0.2
  let simplificationIntensity = 0.0

  // High confusion -> slow and simplified breakdown with more examples
  if (state.confusionLevel > 0.7) {
    teachingMode = 'guided_breakdown'
    explanationDepth = Math.min(0.6, explanationDepth)
    pacing = 'slow'
    exampleDensity = Math.max(exampleDensity, 0.8)
    simplificationIntensity = 0.8
    challengeLevel = 0.05
  }

  // Low engagement -> interactive + short bursts
  if (state.engagementLevel < 0.3) {
    teachingMode = 'interactive_learning'
    explanationDepth = Math.min(explanationDepth, 0.45)
    pacing = 'balanced'
    exampleDensity = 0.6
    simplificationIntensity = 0.4
  }

  // High confidence & readiness -> raise challenge
  if (state.confidenceLevel > 0.8 && state.challengeReadiness > 0.7) {
    teachingMode = 'challenge_mode'
    explanationDepth = Math.max(0.7, explanationDepth)
    challengeLevel = Math.max(0.6, state.challengeReadiness)
    pacing = 'balanced'
  }

  // Short-circuit: quick answers when user clearly asks for just that
  if (context && context.requestMode === 'quick') {
    teachingMode = 'quick_answer'
    explanationDepth = 0.25
    pacing = 'fast'
    exampleDensity = 0.2
    simplificationIntensity = 0.2
  }

  // Map learningStyle to subtle defaults (do not override deliberate decisions above)
  if (!['quick_answer', 'challenge_mode', 'interactive_learning'].includes(teachingMode)) {
    switch (profile.learningStyle) {
      case 'visual':
        exampleDensity = Math.max(exampleDensity, 0.7)
        break
      case 'stepwise':
        explanationDepth = Math.max(explanationDepth, 0.6)
        break
      case 'conceptual':
        explanationDepth = Math.max(explanationDepth, 0.65)
        break
      case 'example_driven':
        exampleDensity = Math.max(exampleDensity, 0.75)
        break
    }
  }

  return {
    teachingMode,
    explanationDepth: clamp(explanationDepth),
    pacing,
    exampleDensity: clamp(exampleDensity),
    challengeLevel: clamp(challengeLevel),
    simplificationIntensity: clamp(simplificationIntensity),
    notes: 'Decision from Cortex Adapt v2 (automated heuristics)'
  }
}
