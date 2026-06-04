import memoryService from '../memory/memory.service'
import { LearningProfile } from './types'
import { normalizeDepth } from './scoringSystem'

const DEFAULT_PROFILE = (userId = ''): LearningProfile => ({
  userId,
  learningStyle: 'example_driven',
  difficultyPreference: 'moderate',
  pacingPreference: 'balanced',
  confidenceScore: 0.5,
  confusionScore: 0.0,
  engagementScore: 0.6,
  responseTolerance: 0.5,
  strongestSubjects: [],
  weakestSubjects: [],
  preferredExplanationDepth: 0.6,
  needsFrequentExamples: true,
  adaptationHistory: [],
  conceptMasteryMap: {}
})

export async function getOrCreateProfile(userId: string): Promise<LearningProfile> {
  const p: any = await memoryService.getUserProfile(userId)
  if (!p) {
    const def = DEFAULT_PROFILE(userId)
    await memoryService.updateUserProfile(userId, def)
    return def
  }

  // shallow merge with defaults to ensure fields exist
  const merged: LearningProfile = {
    ...DEFAULT_PROFILE(userId),
    ...p,
    preferredExplanationDepth: normalizeDepth((p && p.preferredExplanationDepth) as any),
    conceptMasteryMap: (p && p.conceptMasteryMap) || {}
  }
  return merged
}

export async function updateProfile(userId: string, patch: Partial<LearningProfile>) {
  await memoryService.updateUserProfile(userId, patch)
}

export async function setPreferredExplanationDepth(userId: string, depth: number) {
  const d = normalizeDepth(depth)
  await updateProfile(userId, { preferredExplanationDepth: d })
}
