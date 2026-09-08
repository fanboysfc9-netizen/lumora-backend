import { analyzeAdaptiveSignal, buildAdaptiveLearningSignal, decideNale, updateAdaptiveVortex } from '../adaptive-intelligence'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

const event = (timestamp: number, outcome: 'success' | 'failure', topic = 'Functions') => ({ timestamp, outcome, topic })

export function run() {
  const now = Date.now()
  const struggling = buildAdaptiveLearningSignal({
    subject: 'Computer Science', topic: 'Functions',
    events: [event(now - 3000, 'failure'), event(now - 2000, 'failure'), event(now - 1000, 'unknown' as any)]
  })
  const strugglingObservations = analyzeAdaptiveSignal(struggling)
  const strugglingDecision = decideNale(struggling, updateAdaptiveVortex(struggling, now))
  assert(strugglingObservations.includes('repeated_error'), 'Repeated failures must produce repeated_error')
  assert(strugglingDecision.difficultyLevel === 'easier', 'Repeated failures must reduce difficulty')
  assert(strugglingDecision.responseStrategy === 'misconception_focus', 'Repeated failures need misconception-focused teaching')
  assert(strugglingDecision.practiceNeeded, 'Struggling students need targeted practice')

  const improving = buildAdaptiveLearningSignal({
    subject: 'Computer Science', topic: 'Functions',
    nextLearningItem: 'Modules',
    events: [event(now - 4000, 'success'), event(now - 3000, 'success'), event(now - 2000, 'success')]
  })
  const improvingObservations = analyzeAdaptiveSignal(improving)
  const improvingDecision = decideNale(improving, updateAdaptiveVortex(improving, now))
  assert(improvingObservations.includes('improving_performance'), 'Successful trend must produce improving_performance')
  assert(improvingDecision.difficultyLevel === 'harder', 'Improving performance should increase challenge')
  assert(improvingDecision.nextStep === 'Modules', 'Improving performance should progress to the next item')

  const insufficient = buildAdaptiveLearningSignal({ subject: 'Mathematics', topic: 'Algebra' })
  const insufficientObservations = analyzeAdaptiveSignal(insufficient)
  const insufficientDecision = decideNale(insufficient, updateAdaptiveVortex(insufficient, now))
  assert(insufficientObservations.includes('insufficient_evidence'), 'Missing outcomes must remain insufficient evidence')
  assert(!insufficientObservations.includes('topic_mastery_signal'), 'Missing data must not imply mastery')
  assert(insufficientDecision.difficultyLevel === 'steady', 'Missing data must use neutral difficulty')
  assert(!insufficientDecision.practiceNeeded, 'Missing data must not invent a practice need')

  const confused = buildAdaptiveLearningSignal({
    topic: 'Functions', behavior: { repeatedConfusionCount: 2, recentFollowUps: 2, recentQuestionRatio: 1, avgMessageLength: 40, confusionDelta: 0.3, engagementDelta: 0, boredomSignal: 0, quickUnderstandingSignal: 0 }
  })
  const confusedDecision = decideNale(confused, updateAdaptiveVortex(confused, now))
  assert(confused.evidenceLevel === 'limited', 'Repeated confusion should count as limited evidence')
  assert(confusedDecision.responseStrategy === 'misconception_focus', 'Repeated confusion should trigger conservative support')

  const project = buildAdaptiveLearningSignal({
    subject: 'Computer Science', topic: 'Functions', projectProgress: 40,
    events: [event(now - 1000, 'failure')]
  })
  assert(project.projectProgress === 0.4, 'Project progress must remain grounded and normalized')
  assert(project.subject === 'Computer Science', 'Project subject must remain available to adaptation')

  const stale = buildAdaptiveLearningSignal({
    topic: 'Functions', events: [event(now - 49 * 60 * 60 * 1000, 'failure'), event(now - 1000, 'success')]
  })
  const vortex = updateAdaptiveVortex(stale, now)
  assert(vortex.interactionCount === 1, 'Vortex must preserve the established 48-hour window')
  assert(!vortex.observations.includes('repeated_error'), 'Vortex must not use stale failures')

  console.log('[PASS] adaptive intelligence foundation')
}

if (require.main === module) run()
