// Lightweight scoring helpers
import { LearningProfile } from './types'

export const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v))

export function movingAverage(oldVal: number, newVal: number, alpha = 0.25) {
  return clamp(oldVal * (1 - alpha) + newVal * alpha)
}

export function applyDeltaToScore(current: number, delta: number, weight = 1) {
  return clamp(current + delta * weight)
}

export function normalizeDepth(depth?: number) {
  if (typeof depth !== 'number') return 0.6
  return clamp(depth)
}

export function safeProfileMerge(existing: Partial<LearningProfile>, patch: Partial<LearningProfile>) {
  return { ...existing, ...patch }
}

// Maximum allowed absolute change per profile update to ensure stability
export const MAX_CHANGE_PER_UPDATE = 0.05

/**
 * Blend old and observed conservatively: new = old*0.9 + observed*0.1 but
 * limit absolute change to MAX_CHANGE_PER_UPDATE by default.
 */
export function conservativeBlend(oldVal: number, observedVal: number, alpha = 0.1, maxChange = MAX_CHANGE_PER_UPDATE) {
  const blended = clamp(oldVal * (1 - alpha) + observedVal * alpha)
  const delta = blended - oldVal
  if (Math.abs(delta) <= maxChange) return blended
  // cap the delta
  return clamp(oldVal + Math.sign(delta) * maxChange)
}
