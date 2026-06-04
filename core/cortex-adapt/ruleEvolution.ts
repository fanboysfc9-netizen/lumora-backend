import globalEngine from './globalEngine'
import { AdaptationDecision, GlobalLearningStats } from './types'
import memoryService from '../memory/memory.service'
import { clamp } from './scoringSystem'

function mapStrategyToTeachingMode(strategy: string): AdaptationDecision['teachingMode'] | null {
  const s = (strategy || '').toLowerCase()
  if (s.includes('example')) return 'guided_breakdown'
  if (s.includes('concept')) return 'conceptual_teaching'
  if (s.includes('interactive')) return 'interactive_learning'
  if (s.includes('challenge')) return 'challenge_mode'
  if (s.includes('quick')) return 'quick_answer'
  return null
}

export async function applyRuleEvolution() {
  const stats = await globalEngine.getGlobalLearningStats()
  const weights = await globalEngine.getStrategyWeights()
  const entries = Object.entries(weights).sort((a, b) => b[1] - a[1])
  const best = entries.slice(0, 5).filter(e => e[1] > 0).map(e => e[0])
  const worst = entries.slice(-5).filter(e => e[1] > 0).map(e => e[0])

  // Safety check: only apply evolution if global metrics show improvement
  try {
    const snapshot = await (memoryService as any).getGlobalItem?.('last_rule_evolution_snapshot')
    const topStrategy = entries.length > 0 ? entries[0][0] : null
    const topStats = (stats.strategyStats && topStrategy && stats.strategyStats[topStrategy]) || null
    const topSuccess = topStats ? (topStats.successRate || 0) : 0

    const prevTopSuccess = snapshot && snapshot.topSuccess ? snapshot.topSuccess : 0
    const prevAvgConfusion = snapshot && typeof snapshot.averageConfusionLevel === 'number' ? snapshot.averageConfusionLevel : (stats.averageConfusionLevel || 0)
    const prevAvgConfidence = snapshot && typeof snapshot.averageConfidenceLevel === 'number' ? snapshot.averageConfidenceLevel : (stats.averageConfidenceLevel || 0)

    const deltaSuccess = topSuccess - prevTopSuccess
    const deltaConfusion = (prevAvgConfusion || 0) - (stats.averageConfusionLevel || 0)
    const deltaConfidence = Math.abs((stats.averageConfidenceLevel || 0) - (prevAvgConfidence || 0))

    // Conditions: success improved slightly, confusion decreased slightly, confidence stable
    if (deltaSuccess > 0.01 && deltaConfusion > 0.01 && deltaConfidence <= 0.05) {
      stats.bestTeachingStrategies = best
      stats.worstPerformingStrategies = worst
      stats.updatedAt = Date.now()
      await globalEngine.recordInteraction({ userId: '__system__', timestamp: Date.now(), success: true })
      // persist snapshot of this successful evolution
      try {
        await (memoryService as any).setGlobalItem?.('last_rule_evolution_snapshot', {
          topStrategy,
          topSuccess,
          averageConfusionLevel: stats.averageConfusionLevel,
          averageConfidenceLevel: stats.averageConfidenceLevel,
          timestamp: Date.now()
        })
      } catch (e) {
        // ignore persistence errors
      }
    }
  } catch (e) {
    // If safety checks fail, do nothing — evolution is conservative
    console.warn('[RuleEvolution] safety check failed or skipped:', (e as any)?.message || e)
  }

  return stats
}

export function adjustDecisionWithGlobalTrends(decision: AdaptationDecision, globalStats?: GlobalLearningStats) {
  if (!globalStats || !globalStats.strategyWeights) return decision
  const weights = globalStats.strategyWeights
  // find top strategy
  const entries = Object.entries(weights).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return decision
  const top = entries[0][0]
  const mapped = mapStrategyToTeachingMode(top)
  const out: AdaptationDecision = { ...decision }
  if (mapped) {
    out.teachingMode = mapped
    // nudge example density if top strategy suggests examples
    if (mapped === 'guided_breakdown') out.exampleDensity = Math.max(out.exampleDensity, 0.7)
    if (mapped === 'conceptual_teaching') out.explanationDepth = Math.max(out.explanationDepth, 0.65)
    if (mapped === 'interactive_learning') out.pacing = 'balanced'
  }
  return out
}

export default { applyRuleEvolution, adjustDecisionWithGlobalTrends }
