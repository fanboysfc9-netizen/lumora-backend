import { BehaviorSummary } from './types'
import { clamp } from './scoringSystem'

export type LearningOutcome = 'success' | 'failure' | 'unknown'

export type LearningEvent = {
  timestamp: number
  topic?: string
  subject?: string
  outcome?: LearningOutcome
  confusionObserved?: boolean
}

export type AdaptiveLearningSignal = {
  subject: string | null
  topic: string | null
  recentTopics: string[]
  recentInteractionCount: number
  outcomesAvailable: boolean
  successCount: number
  failureCount: number
  repeatedMistakeCount: number
  repeatedConfusionCount: number
  apparentDifficulty: 'low' | 'moderate' | 'high' | 'unknown'
  performanceTrend: 'improving' | 'declining' | 'stable' | 'unknown'
  learningMomentum: 'building' | 'slowing' | 'steady' | 'unknown'
  projectProgress?: number
  studyPlanProgress?: number
  currentLearningItem?: string | null
  nextLearningItem?: string | null
  evidenceLevel: 'none' | 'limited' | 'moderate' | 'strong'
  events: LearningEvent[]
}

export type AdaptiveObservation =
  | 'repeated_error'
  | 'improving_performance'
  | 'struggling_topic'
  | 'topic_mastery_signal'
  | 'inactive_learning'
  | 'rapid_progress'
  | 'insufficient_evidence'

export type VortexState = {
  windowHours: 48
  interactionCount: number
  recentTopics: string[]
  observations: AdaptiveObservation[]
  currentTopic: string | null
  repeatedMistakes: number
  successRate: number | null
  momentum: AdaptiveLearningSignal['learningMomentum']
  evidenceLevel: AdaptiveLearningSignal['evidenceLevel']
}

export type NaleDecision = {
  explanationDepth: 'brief' | 'standard' | 'deep'
  difficultyLevel: 'easier' | 'steady' | 'harder'
  responseStrategy: 'neutral' | 'misconception_focus' | 'guided_explanation' | 'extension'
  practiceNeeded: boolean
  misconceptionFocus: string | null
  pacing: 'slow' | 'balanced' | 'brisk'
  nextStep: string | null
}

function clean(value: unknown) {
  const text = String(value || '').trim()
  return text || null
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function uniqueObservations(values: AdaptiveObservation[]): AdaptiveObservation[] {
  return [...new Set(values)]
}

export function buildAdaptiveLearningSignal(input: {
  subject?: string | null
  topic?: string | null
  behavior?: BehaviorSummary | null
  events?: LearningEvent[]
  projectProgress?: number
  studyPlanProgress?: number
  currentLearningItem?: string | null
  nextLearningItem?: string | null
}): AdaptiveLearningSignal {
  const events = (input.events || []).filter((event) => Number.isFinite(event.timestamp))
  const successes = events.filter((event) => event.outcome === 'success').length
  const failures = events.filter((event) => event.outcome === 'failure').length
  const outcomesAvailable = successes + failures > 0
  const repeatedMistakeCount = events.filter((event) => event.outcome === 'failure').length
  const behavior = input.behavior || null
  const repeatedConfusionCount = behavior?.repeatedConfusionCount || 0
  const interactionCount = events.length || (behavior ? Math.max(0, Math.round(behavior.recentFollowUps)) : 0)
  const recentTopics = unique([input.topic, ...events.map((event) => event.topic)])
  const apparentDifficulty = !outcomesAvailable
    ? 'unknown'
    : failures >= 2 || (behavior?.repeatedConfusionCount || 0) >= 2 ? 'high'
      : failures > successes ? 'moderate' : 'low'
  const performanceTrend = !outcomesAvailable || events.length < 2
    ? 'unknown'
    : successes > failures && events[events.length - 1]?.outcome === 'success' ? 'improving'
      : failures > successes && events[events.length - 1]?.outcome === 'failure' ? 'declining' : 'stable'
  const learningMomentum = interactionCount === 0
    ? 'unknown'
    : performanceTrend === 'improving' ? 'building'
      : performanceTrend === 'declining' ? 'slowing' : 'steady'
  const evidenceLevel = events.length >= 5 ? 'strong' : events.length >= 2 ? 'moderate' : events.length === 1 || repeatedConfusionCount > 0 ? 'limited' : 'none'

  return {
    subject: clean(input.subject),
    topic: clean(input.topic),
    recentTopics,
    recentInteractionCount: interactionCount,
    outcomesAvailable,
    successCount: successes,
    failureCount: failures,
    repeatedMistakeCount,
    repeatedConfusionCount,
    apparentDifficulty,
    performanceTrend,
    learningMomentum,
    projectProgress: typeof input.projectProgress === 'number' ? clamp(input.projectProgress / 100) : undefined,
    studyPlanProgress: typeof input.studyPlanProgress === 'number' ? clamp(input.studyPlanProgress / 100) : undefined,
    currentLearningItem: clean(input.currentLearningItem),
    nextLearningItem: clean(input.nextLearningItem),
    evidenceLevel,
    events
  }
}

export function analyzeAdaptiveSignal(signal: AdaptiveLearningSignal): AdaptiveObservation[] {
  const observations: AdaptiveObservation[] = []
  if (signal.evidenceLevel === 'none' || !signal.outcomesAvailable) observations.push('insufficient_evidence')
  if (signal.failureCount >= 2 && signal.topic) {
    observations.push('repeated_error', 'struggling_topic')
  } else if (signal.repeatedConfusionCount >= 2 && signal.topic) {
    observations.push('struggling_topic')
  }
  if (signal.performanceTrend === 'improving') observations.push('improving_performance')
  if (signal.successCount >= 3 && signal.failureCount === 0) observations.push('topic_mastery_signal')
  if (signal.learningMomentum === 'slowing' && signal.recentInteractionCount > 0) observations.push('inactive_learning')
  if (signal.performanceTrend === 'improving' && signal.successCount >= 3) observations.push('rapid_progress')
  return uniqueObservations(observations)
}

export function updateAdaptiveVortex(signal: AdaptiveLearningSignal, now = Date.now()): VortexState {
  const windowStart = now - 48 * 60 * 60 * 1000
  const recentEvents = signal.events.filter((event) => event.timestamp >= windowStart)
  const recentSignal = recentEvents.length ? buildAdaptiveLearningSignal({ ...signal, events: recentEvents }) : signal
  const observations = analyzeAdaptiveSignal(recentSignal)
  const measured = recentSignal.successCount + recentSignal.failureCount
  return {
    windowHours: 48,
    interactionCount: recentEvents.length,
    recentTopics: recentSignal.recentTopics,
    observations,
    currentTopic: recentSignal.currentLearningItem || recentSignal.topic,
    repeatedMistakes: recentSignal.repeatedMistakeCount || recentSignal.repeatedConfusionCount,
    successRate: measured ? recentSignal.successCount / measured : null,
    momentum: recentSignal.learningMomentum,
    evidenceLevel: recentSignal.evidenceLevel
  }
}

export function decideNale(signal: AdaptiveLearningSignal, vortex: VortexState): NaleDecision {
  const struggling = vortex.observations.includes('repeated_error') || vortex.observations.includes('struggling_topic')
  const improving = vortex.observations.includes('improving_performance') || vortex.observations.includes('rapid_progress')
  if (struggling && signal.evidenceLevel !== 'none') {
    return {
      explanationDepth: 'deep', difficultyLevel: 'easier', responseStrategy: 'misconception_focus',
      practiceNeeded: true, misconceptionFocus: signal.topic || signal.currentLearningItem || null,
      pacing: 'slow', nextStep: signal.currentLearningItem || signal.nextLearningItem || null
    }
  }
  if (improving && signal.evidenceLevel !== 'none') {
    return {
      explanationDepth: 'standard', difficultyLevel: 'harder', responseStrategy: 'extension',
      practiceNeeded: true, misconceptionFocus: null, pacing: 'balanced', nextStep: signal.nextLearningItem || null
    }
  }
  return {
    explanationDepth: 'standard', difficultyLevel: 'steady', responseStrategy: 'neutral',
    practiceNeeded: false, misconceptionFocus: null, pacing: 'balanced', nextStep: signal.currentLearningItem || signal.nextLearningItem || null
  }
}

export function adaptivePromptInstruction(decision: NaleDecision): string {
  const parts = [
    `Use a ${decision.explanationDepth} explanation with ${decision.pacing} pacing.`,
    decision.responseStrategy === 'misconception_focus' ? 'Focus on the likely misconception, use a worked example, and finish with a short targeted practice check.' : '',
    decision.responseStrategy === 'extension' ? 'Avoid repeating basics unnecessarily; add a modest challenge or extension.' : '',
    decision.practiceNeeded && decision.responseStrategy === 'neutral' ? 'Include a brief practice check when it fits.' : '',
    decision.nextStep ? `Keep the next learning step aligned with ${decision.nextStep}.` : '',
    'Adapt from observed learning evidence only; do not mention internal adaptation or scores.'
  ]
  return parts.filter(Boolean).join(' ')
}

export default { buildAdaptiveLearningSignal, analyzeAdaptiveSignal, updateAdaptiveVortex, decideNale, adaptivePromptInstruction }
