import { AdaptationDecision, LearningProfile, PredictionState, GlobalLearningStats } from './types'

export function buildPromptModifiers(decision: AdaptationDecision, profile?: LearningProfile) {
  // Return a compact object that can be embedded in the system prompt or fed
  // to the Core prompt builder to adjust instructions dynamically.
  return {
    teachingStyle: decision.teachingMode,
    pacing: decision.pacing,
    explanationDepth: decision.explanationDepth,
    exampleDensity: decision.exampleDensity,
    challengeLevel: decision.challengeLevel,
    simplificationIntensity: decision.simplificationIntensity,
    subtleNote: 'Adapt quietly; do not mention diagnostics or scores.'
  }
}

export function toSystemInstruction(decision: AdaptationDecision, profile?: LearningProfile, prediction?: PredictionState, globalStats?: GlobalLearningStats) {
  const parts: string[] = []
  parts.push(`Adopt a ${decision.teachingMode.replace(/_/g, ' ')} tutor style.`)
  parts.push(`Pacing: ${decision.pacing}. Keep the flow ${decision.pacing === 'slow' ? 'calm and stepwise' : 'concise and focused'}.`)
  parts.push(`Explanation depth: ${Math.round(decision.explanationDepth * 100)}% — prefer natural prose and examples when helpful.`)

  // Apply prediction recommendation conservatively (do not surface numbers)
  if (prediction) {
    if (prediction.recommendation === 'simplify') {
      parts.push('Prefer simplified explanations: break into short numbered steps and include a brief check for understanding.')
    } else if (prediction.recommendation === 'challenge') {
      parts.push('Include a short challenge question or prompt to test understanding when appropriate.')
    } else {
      parts.push('Provide a concise elaboration with a concrete example when helpful.')
    }
  }

  if (decision.exampleDensity > 0.5) parts.push('Prefer concrete examples and short analogies.')
  if (decision.simplificationIntensity > 0.5) parts.push('When confusion is present, simplify with smaller steps and checks for understanding.')

  // Global trends: soft nudges only (do not reveal analytics)
  try {
    if (globalStats && globalStats.strategyWeights) {
      const top = Object.entries(globalStats.strategyWeights).sort((a, b) => b[1] - a[1])[0]
      if (top && top[1] > 0.6) {
        // if a strategy is strongly favored system-wide, nudge but do not enforce
        parts.push('Soft preference: favor the teaching pattern that has been working well across learners.')
      }
    }
  } catch (e) {
    // ignore
  }

  parts.push('Do not mention internal scoring, adaptation logic, or analytics to the user.')
  parts.push('Keep tone human, encouraging, and non-robotic.')

  // Keep instruction concise; Core may merge this into a larger prompt package
  return parts.join(' ')
}
