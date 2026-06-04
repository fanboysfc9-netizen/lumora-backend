export type Intent = 'question' | 'explanation' | 'problem' | 'command' | 'unknown'

export type UserLevel = 'beginner' | 'average' | 'advanced'
export type Strictness = 'low' | 'moderate' | 'high'
export type Difficulty = 'easy' | 'medium' | 'hard'

export type ResponseType =
  | 'casual'
  | 'definition'
  | 'problem_solving'
  | 'conceptual'
  | 'emotional'
  | 'conversation'
  | 'advanced_learning'

export interface ResponseStructure {
  useSections?: boolean // whether the model should include labeled sections
  sections?: string[] // suggested section labels when beneficial
  tone?: string // e.g., 'calm', 'empathetic', 'encouraging'
  pacing?: 'normal' | 'slow' | 'measured' // reading/speaking pacing hints
  empathy?: boolean
  brief?: boolean
}

export interface NormalizedInput {
  raw: string
  cleaned: string
  intent: Intent
  subjectHints: string[]
  confidence: number // 0..1
  tokens: number
}

export interface PromptPackageObject {
  prompt: string
  instructions: string[]
  metadata: {
    userLevel: UserLevel
    strictness: Strictness
    intent: Intent
    subject: string | null
    maxLines?: number
    needsAdaptation?: boolean
    difficulty?: Difficulty
    responseType?: ResponseType
    responseStructure?: ResponseStructure
    userLanguage?: string
  }
}

export interface CoreOutput {
  rawInput: string
  intent: Intent
  subject: string | null
  promptPackage: string // serialized prompt package ready for next layer
  metadata: {
    confidence: number
    needsAdaptation: boolean
  }
}

export interface ProcessOptions {
  userLevel?: UserLevel
  maxLines?: number
  strictness?: Strictness
  difficulty?: Difficulty
  hooks?: {
    adapt?: any
    refine?: any
  }
}

const lumoraCoreTypes = {
  intents: ['question', 'explanation', 'problem', 'command', 'unknown'] as Intent[],
  userLevels: ['beginner', 'average', 'advanced'] as UserLevel[],
  strictnessLevels: ['low', 'moderate', 'high'] as Strictness[],
  difficulties: ['easy', 'medium', 'hard'] as Difficulty[],
  responseTypes: [
    'casual',
    'definition',
    'problem_solving',
    'conceptual',
    'emotional',
    'conversation',
    'advanced_learning',
  ] as ResponseType[],
}

export default lumoraCoreTypes
