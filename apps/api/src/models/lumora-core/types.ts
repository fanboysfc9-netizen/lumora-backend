export interface LumoraCoreInput {
  question: string
  userLevel?: 'beginner' | 'average' | 'advanced'
  maxLines?: number
  strictness?: 'low' | 'moderate' | 'high'
  difficulty?: 'easy' | 'medium' | 'hard'
}

export interface LumoraCoreResponse {
  /** Short, simple explanation in plain language */
  explanation: string
  /** Intuition / why it works — short, student-facing reasoning */
  intuition?: string
  /** Optional step-by-step breakdown when applicable */
  steps?: string[]
  /** A brief illustrative example */
  example?: string
  /** Very short recap (1-2 lines) */
  recap?: string
  /** Raw text for downstream rendering or debugging */
  raw?: string
}

export interface PromptBuildResult {
  prompt: string
  metadata?: Record<string, any>
}

const lumoraCoreApiTypes = {
  userLevels: ['beginner', 'average', 'advanced'] as Array<NonNullable<LumoraCoreInput['userLevel']>>,
  strictnessLevels: ['low', 'moderate', 'high'] as Array<NonNullable<LumoraCoreInput['strictness']>>,
  difficulties: ['easy', 'medium', 'hard'] as Array<NonNullable<LumoraCoreInput['difficulty']>>,
}

export default lumoraCoreApiTypes
