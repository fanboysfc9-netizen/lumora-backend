import { LearningProfile, BehaviorSummary, PredictionState, AdaptationDecision } from './types'
import { clamp } from './scoringSystem'

// Predictive heuristics for Cortex Adapt v3.5 (initial implementation)

function textComplexityScore(text: string) {
  if (!text) return 0
  const words = text.split(/\s+/).filter(Boolean).length
  const sentences = text.split(/[\.\!\?]+/).filter(s => s.trim().length > 0).length || 1
  const avgWordsPerSentence = words / sentences
  // Normalize: avg 5 words -> low, 20+ -> high
  const score = clamp((avgWordsPerSentence - 6) / 18)
  return score
}

export async function predictBeforeResponse(
  input: string,
  profile: LearningProfile,
  behavior?: BehaviorSummary
): Promise<PredictionState> {
  const base: PredictionState = {
    confusionRisk: 0.05,
    overloadRisk: 0.03,
    engagementRisk: 0.03,
    recommendation: 'expand',
    notes: 'baseline'
  }

  try {
    const len = (input || '').length
    const lc = (input || '').toLowerCase()

    // Heuristic: many questions or explicit confusion words -> raise confusion
    const questionTokens = (lc.match(/\b(why|how|what|don't understand|confused|help|explain)\b/g) || []).length
    if (questionTokens > 0) base.confusionRisk = clamp(base.confusionRisk + 0.18 + Math.min(0.12, questionTokens * 0.04))

    // Repetition / behaviour
    if (behavior) {
      base.confusionRisk = clamp(base.confusionRisk + Math.min(0.35, behavior.repeatedConfusionCount * 0.15))
      base.engagementRisk = clamp(base.engagementRisk + Math.max(0, 0.1 - behavior.quickUnderstandingSignal))
    }

    // Message length and complexity -> overload
    if (len > 400) base.overloadRisk = clamp(base.overloadRisk + 0.25)
    if (len > 1200) base.overloadRisk = clamp(base.overloadRisk + 0.25)
    base.overloadRisk = clamp(base.overloadRisk + textComplexityScore(input) * 0.6)

    // Profile signals
    if (profile) {
      // users who prefer shallow depth are more likely to be overloaded by dense answers
      if (profile.preferredExplanationDepth < 0.45) base.overloadRisk = clamp(base.overloadRisk + (0.45 - profile.preferredExplanationDepth) * 0.6)
      if (profile.confusionScore && profile.confusionScore > 0.6) base.confusionRisk = clamp(base.confusionRisk + 0.15)
      if (profile.engagementScore && profile.engagementScore < 0.4) base.engagementRisk = clamp(base.engagementRisk + 0.2)
      // Roughly check for mentioned concepts in profile weak list (string match)
      if (Array.isArray(profile.weakestSubjects) && profile.weakestSubjects.length > 0) {
        for (const subj of profile.weakestSubjects) {
          if (subj && input.toLowerCase().includes(subj.toLowerCase())) {
            base.confusionRisk = clamp(base.confusionRisk + 0.12)
            base.engagementRisk = clamp(base.engagementRisk + 0.08)
          }
        }
      }
    }

    // Recommendation logic: prefer simplification when confusion/overload is high
    if (base.confusionRisk > 0.55 || base.overloadRisk > 0.55) base.recommendation = 'simplify'
    else if (profile && profile.confidenceScore && profile.confidenceScore > 0.75 && base.confusionRisk < 0.2) base.recommendation = 'challenge'
    else base.recommendation = 'expand'

    base.notes = 'heuristic prediction'
  } catch (e) {
    // keep baseline on error
    base.notes = `prediction error: ${(e as any)?.message || String(e)}`
  }

  return base
}

export async function simulateUserReaction(
  explanation: string,
  profile: LearningProfile,
  behavior?: BehaviorSummary
): Promise<PredictionState> {
  // Use simpler heuristics to estimate how a typical user might react to a candidate explanation
  const base: PredictionState = {
    confusionRisk: 0.1,
    overloadRisk: 0.05,
    engagementRisk: 0.05,
    recommendation: 'expand',
    notes: 'simulation baseline'
  }

  try {
    const lc = (explanation || '').toLowerCase()
    const complexity = textComplexityScore(explanation)

    // If explanation contains step markers or examples, reduce risks
    const hasSteps = /\b(step|first|second|then|next)\b/.test(lc)
    const hasExample = /\b(example|for instance|e\.g\.|for example)\b/.test(lc)

    base.confusionRisk = clamp(base.confusionRisk + complexity * 0.6 - (hasSteps ? 0.2 : 0) - (hasExample ? 0.18 : 0))
    base.overloadRisk = clamp(base.overloadRisk + complexity * 0.8 - (hasSteps ? 0.25 : 0))
    base.engagementRisk = clamp(base.engagementRisk + (hasExample ? -0.08 : 0) + (hasSteps ? -0.05 : 0))

    // Profile adjustments
    if (profile && profile.needsFrequentExamples) {
      base.confusionRisk = clamp(base.confusionRisk - 0.06)
    }

    // Behavior: many recent follow-ups -> simulation expects higher confusion
    if (behavior && behavior.recentFollowUps > 2) {
      base.confusionRisk = clamp(base.confusionRisk + 0.12)
    }

    // simulation recommendation
    if (base.confusionRisk > 0.5 || base.overloadRisk > 0.5) base.recommendation = 'simplify'
    else if (profile && profile.confidenceScore && profile.confidenceScore > 0.75 && base.confusionRisk < 0.2) base.recommendation = 'challenge'
    else base.recommendation = 'expand'

    base.notes = 'simulation heuristics'
  } catch (e) {
    base.notes = `simulation error: ${(e as any)?.message || String(e)}`
  }

  return base
}

export function generatePreResponseModifiers(prediction: PredictionState) {
  const simplify = prediction.confusionRisk > 0.55 || prediction.overloadRisk > 0.5
  const breakIntoSteps = prediction.confusionRisk > 0.35
  const addExamples = prediction.confusionRisk > 0.35 || prediction.overloadRisk > 0.25
  const pacing: 'slow' | 'balanced' | 'fast' = prediction.confusionRisk > 0.5 ? 'slow' : prediction.engagementRisk > 0.6 ? 'fast' : 'balanced'
  const depthModifier = simplify ? -0.25 : prediction.confusionRisk < 0.2 ? 0.15 : 0

  return {
    simplify,
    breakIntoSteps,
    addExamples,
    pacing,
    depthModifier
  }
}

export function adjustDecisionWithPrediction(decision: AdaptationDecision, prediction: PredictionState): AdaptationDecision {
  const out: AdaptationDecision = { ...decision }

  if (prediction.confusionRisk > 0.6) {
    out.simplificationIntensity = Math.max(out.simplificationIntensity, 0.8)
    out.exampleDensity = Math.max(out.exampleDensity, 0.8)
    out.pacing = 'slow'
    out.explanationDepth = Math.min(0.55, out.explanationDepth)
  }

  if (prediction.confusionRisk > 0.5) {
    out.exampleDensity = Math.max(out.exampleDensity, 0.75)
    out.simplificationIntensity = Math.max(out.simplificationIntensity, 0.6)
    out.explanationDepth = Math.max(out.explanationDepth, 0.55)
  }

  if (prediction.overloadRisk > 0.5) {
    out.explanationDepth = Math.min(out.explanationDepth, 0.45)
    out.simplificationIntensity = Math.max(out.simplificationIntensity, 0.7)
    out.pacing = 'slow'
  }

  if (prediction.engagementRisk > 0.6) {
    out.pacing = 'balanced'
    out.exampleDensity = Math.min(0.6, out.exampleDensity)
  }

  out.simplificationIntensity = clamp(out.simplificationIntensity)
  out.exampleDensity = clamp(out.exampleDensity)
  out.explanationDepth = clamp(out.explanationDepth)

  return out
}

export function scorePredictionOutcome(prediction: PredictionState, actualOutcome: any) {
  // actualOutcome can be a flexible object: { confusionObserved: boolean, followUps: number, satisfaction: 0..1 }
  let score = 1
  try {
    if (!actualOutcome) return { score: 0.5, details: 'no outcome' }
    const confusionObserved = !!actualOutcome.confusionObserved
    const followUps = Number(actualOutcome.followUps || 0)
    const satisfaction = typeof actualOutcome.satisfaction === 'number' ? actualOutcome.satisfaction : 0.5

    // penalize if prediction said low confusion but confusionObserved true
    if (confusionObserved && prediction.confusionRisk < 0.4) score -= 0.4
    // reward if low followUps and prediction predicted low confusion
    if (followUps === 0 && prediction.confusionRisk < 0.4) score += 0.2
    score += (satisfaction - 0.5) * 0.5
    score = clamp(score)
  } catch (e) {
    return { score: 0.5, details: `scoring error: ${(e as any)?.message || String(e)}` }
  }

  return { score, details: 'heuristic score' }
}

export function decideMidResponseAction(currentText: string, prediction: PredictionState, profile?: LearningProfile) {
  // Lightweight heuristics to recommend a mid-response adjustment
  const complexity = textComplexityScore(currentText)
  if (complexity > 0.6 && prediction.overloadRisk > 0.4) {
    return { action: 'simplify', reason: 'high local complexity and overload risk' }
  }
  if (prediction.confusionRisk > 0.6 && /\bfor example|e\.g\.|for instance\b/i.test(currentText) === false) {
    return { action: 'insert_example', reason: 'high misconception risk and no example present' }
  }
  return { action: null, reason: 'no adjustment needed' }
}

export default {
  predictBeforeResponse,
  simulateUserReaction,
  generatePreResponseModifiers,
  adjustDecisionWithPrediction,
  scorePredictionOutcome,
  decideMidResponseAction
}
