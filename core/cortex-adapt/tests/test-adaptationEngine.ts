import { decideAdaptation } from '../adaptationEngine'
import { LearningProfile, CognitiveState } from '../types'

function assert(cond: boolean, msg?: string) {
  if (!cond) throw new Error(msg || 'Assertion failed')
}

export function run() {
  console.log('[TEST] adaptationEngine')

  const profile: LearningProfile = {
    userId: 'test-user',
    learningStyle: 'stepwise',
    difficultyPreference: 'moderate',
    pacingPreference: 'balanced',
    confidenceScore: 0.4,
    confusionScore: 0.6,
    engagementScore: 0.5,
    responseTolerance: 0.5,
    strongestSubjects: [],
    weakestSubjects: [],
    preferredExplanationDepth: 0.6,
    needsFrequentExamples: true,
    adaptationHistory: []
  }

  // Case: high confusion -> guided_breakdown, slow
  const state1: CognitiveState = { confusionLevel: 0.8, confidenceLevel: 0.2, overloadRisk: 0.1, engagementLevel: 0.4, challengeReadiness: 0.1 }
  const d1 = decideAdaptation(profile, state1, {})
  assert(d1.teachingMode === 'guided_breakdown', 'Expected guided_breakdown for high confusion')
  assert(d1.pacing === 'slow', 'Expected slow pacing for high confusion')

  // Case: high confidence + readiness -> challenge_mode
  const state2: CognitiveState = { confusionLevel: 0.05, confidenceLevel: 0.9, overloadRisk: 0, engagementLevel: 0.9, challengeReadiness: 0.85 }
  const d2 = decideAdaptation(profile, state2, {})
  assert(d2.teachingMode === 'challenge_mode', 'Expected challenge_mode for high confidence/readiness')

  console.log('[PASS] adaptationEngine')
}
