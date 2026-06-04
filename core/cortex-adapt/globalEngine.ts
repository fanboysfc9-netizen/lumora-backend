import memoryService from '../memory/memory.service'
import { GlobalLearningStats } from './types'
import { movingAverage } from './scoringSystem'

const DEFAULT_STATS = (): GlobalLearningStats => ({
  totalUsers: 0,
  bestTeachingStrategies: [],
  worstPerformingStrategies: [],
  subjectDifficultyRanking: {},
  averageConfusionTriggers: [],
  optimizedPromptPatterns: [],
  strategyStats: {},
  strategyWeights: {},
  averageConfusionLevel: 0,
  averageConfidenceLevel: 0,
  updatedAt: Date.now()
})

export async function getGlobalLearningStats(): Promise<GlobalLearningStats> {
  let gs: any = {}
  try {
    if (memoryService && typeof (memoryService as any).getGlobalStats === 'function') {
      gs = (await (memoryService as any).getGlobalStats()) || {}
    } else if (memoryService && typeof (memoryService as any).getGlobalItem === 'function') {
      gs = (await (memoryService as any).getGlobalItem('learning_stats')) || {}
    }
  } catch (e) {
    gs = {}
  }
  if (!gs || Object.keys(gs).length === 0) return DEFAULT_STATS()
  // normalize
  return { ...DEFAULT_STATS(), ...gs }
}

export async function recordStrategyOutcome(strategy: string, success: boolean) {
  const stats = await getGlobalLearningStats()
  stats.strategyStats = stats.strategyStats || {}
  const cur = stats.strategyStats[strategy] || { attempts: 0, successes: 0, successRate: 0 }
  cur.attempts = (cur.attempts || 0) + 1
  if (success) cur.successes = (cur.successes || 0) + 1
  cur.successRate = cur.attempts > 0 ? cur.successes / cur.attempts : 0
  stats.strategyStats[strategy] = cur
  // recompute weights
  stats.strategyWeights = computeStrategyWeights(stats.strategyStats)
  stats.updatedAt = Date.now()
  try {
    if (memoryService && typeof (memoryService as any).updateGlobalStats === 'function') {
      await (memoryService as any).updateGlobalStats(stats)
    }
  } catch (e) {
    // swallow
  }
  return stats
}

export function computeStrategyWeights(strategyStats: Record<string, { attempts: number; successes: number; successRate: number }> = {}) {
  const weights: Record<string, number> = {}
  let sum = 0
  for (const k of Object.keys(strategyStats)) {
    const s = strategyStats[k]
    // weight = successRate * log(attempts + 1)
    const w = (s.successRate || 0) * Math.log(Math.max(1, (s.attempts || 0)))
    weights[k] = Number.isFinite(w) ? w : 0
    sum += weights[k]
  }
  // normalize to 0..1 scale
  if (sum <= 0) {
    for (const k of Object.keys(weights)) weights[k] = 0
    return weights
  }
  for (const k of Object.keys(weights)) weights[k] = Math.max(0, Math.min(1, weights[k] / sum))
  return weights
}

export async function recordInteraction(params: { userId: string; subject?: string; decision?: any; success?: boolean; confusionDelta?: number; confusionLevel?: number; confidenceLevel?: number; timestamp?: number }) {
  const stats = await getGlobalLearningStats()
  // totalUsers is best-effort; do not overcount here unless a unique-user registration happens elsewhere
  if (typeof params.userId === 'string') {
    // increment a global counter for interactions
    try {
      if (memoryService && typeof (memoryService as any).incrementGlobalCounter === 'function') {
        await (memoryService as any).incrementGlobalCounter('interactionCount', 1)
      }
    } catch (e) {
      // ignore
    }
  }

  // record subject difficulty signals
  if (params.subject) {
    const cur = stats.subjectDifficultyRanking || {}
    cur[params.subject] = (cur[params.subject] || 0) + (params.confusionDelta ? Math.max(0, params.confusionDelta) : 0)
    stats.subjectDifficultyRanking = cur
  }

  // update aggregated confusion/confidence rolling averages when provided
  try {
    if (typeof params.confusionLevel === 'number') {
      stats.averageConfusionLevel = movingAverage(stats.averageConfusionLevel || 0, params.confusionLevel, 0.05)
    }
    if (typeof params.confidenceLevel === 'number') {
      stats.averageConfidenceLevel = movingAverage(stats.averageConfidenceLevel || 0, params.confidenceLevel, 0.05)
    }
  } catch (e) {
    // ignore
  }

  // track strategy outcomes
  if (params.decision && params.decision.teachingMode) {
    const strat = String(params.decision.teachingMode)
    await recordStrategyOutcome(strat, !!params.success)
  }

  stats.updatedAt = Date.now()
  try {
    if (memoryService && typeof (memoryService as any).updateGlobalStats === 'function') {
      await (memoryService as any).updateGlobalStats(stats)
    }
  } catch (e) {
    // ignore
  }
  return stats
}

export async function getStrategyWeights() {
  const stats = await getGlobalLearningStats()
  if (stats.strategyWeights && Object.keys(stats.strategyWeights).length > 0) return stats.strategyWeights
  const weights = computeStrategyWeights(stats.strategyStats || {})
  stats.strategyWeights = weights
  try {
    if (memoryService && typeof (memoryService as any).updateGlobalStats === 'function') {
      await (memoryService as any).updateGlobalStats(stats)
    }
  } catch (e) {
    // swallow
  }
  return weights
}

export async function recommendStrategyForSubject(subject?: string) {
  const stats = await getGlobalLearningStats()
  const weights = stats.strategyWeights || computeStrategyWeights(stats.strategyStats || {})
  // prefer strategies with highest weight
  const sorted = Object.entries(weights).sort((a, b) => b[1] - a[1]).map(s => s[0])
  return { recommended: sorted[0] || null, ordered: sorted }
}

export default { getGlobalLearningStats, recordInteraction, recordStrategyOutcome, getStrategyWeights, recommendStrategyForSubject }
