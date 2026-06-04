// Cortex Adapt v2 - types

export type LearningStyle = 'visual' | 'stepwise' | 'conceptual' | 'example_driven'
export type DifficultyPreference = 'easy' | 'moderate' | 'challenging'
export type PacingPreference = 'slow' | 'balanced' | 'fast'

export type TeachingMode =
  | 'quick_answer'
  | 'guided_breakdown'
  | 'conceptual_teaching'
  | 'interactive_learning'
  | 'challenge_mode'
  | 'slow_reinforcement'

export interface AdaptationDecision {
  teachingMode: TeachingMode
  explanationDepth: number // 0..1
  pacing: PacingPreference
  exampleDensity: number // 0..1
  challengeLevel: number // 0..1
  simplificationIntensity: number // 0..1
  notes?: string
}

export interface AdaptationEvent {
  timestamp: number
  reason: string
  delta?: {
    confidenceScore?: number
    confusionScore?: number
    engagementScore?: number
  }
  decision?: AdaptationDecision
  outcome?: 'success' | 'failure' | 'unknown'
}

export interface LearningProfile {
  userId: string
  learningStyle: LearningStyle
  difficultyPreference: DifficultyPreference
  pacingPreference: PacingPreference

  // Scores: normalized 0..1
  confidenceScore: number
  confusionScore: number
  engagementScore: number

  // How tolerant the user is of corrections / challenge (0..1)
  responseTolerance: number

  strongestSubjects: string[]
  weakestSubjects: string[]

  // 0..1 preferred depth for explanations
  preferredExplanationDepth: number

  needsFrequentExamples: boolean

  adaptationHistory: AdaptationEvent[]
  // Per-concept mastery tracking (0..1 understanding level)
  conceptMasteryMap?: Record<string, { understandingLevel: number; misconceptionPatterns: string[]; retryCount: number }>
}

export interface CognitiveState {
  confusionLevel: number
  confidenceLevel: number
  overloadRisk: number
  engagementLevel: number
  challengeReadiness: number
}

export interface BehaviorSummary {
  repeatedConfusionCount: number
  recentFollowUps: number
  recentQuestionRatio: number
  avgMessageLength: number
  confusionDelta: number
  engagementDelta: number
  boredomSignal: number
  quickUnderstandingSignal: number
}

export interface PredictionState {
  confusionRisk: number
  overloadRisk: number
  engagementRisk: number
  recommendation: 'simplify' | 'expand' | 'challenge'
  notes?: string
}

export interface InteractionEvent {
  timestamp: number
  conversationId?: string
  subject?: string
  userMessage?: string
  aiResponseSummary?: string
  outcome?: 'success' | 'failure' | 'unknown'
  metrics?: { confusionLevel?: number; engagementLevel?: number; satisfaction?: number; followUps?: number }
}

export interface StudentProfile {
  userId: string
  learningStyle: 'visual' | 'step_by_step' | 'conceptual' | 'example_based'
  performanceMetrics: {
    confusionLevel: number
    comprehensionSpeed: number
    retentionRate: number
    engagementLevel: number
  }
  subjectWeaknessMap: Record<string, number>
  interactionHistory: InteractionEvent[]
}

export interface GlobalLearningStats {
  totalUsers: number
  bestTeachingStrategies: string[]
  worstPerformingStrategies: string[]
  subjectDifficultyRanking: Record<string, number>
  averageConfusionTriggers: string[]
  optimizedPromptPatterns: string[]
  // internal tracking
  strategyStats?: Record<string, { attempts: number; successes: number; successRate: number }>
  strategyWeights?: Record<string, number>
  averageConfusionLevel?: number
  averageConfidenceLevel?: number
  updatedAt?: number
}
