import { decideAdaptation } from '../cortex-adapt/adaptationEngine'
import { estimateCognitiveState } from '../cortex-adapt/cognitiveEngine'
import { getOrCreateProfile } from '../cortex-adapt/learningProfile'
import { toSystemInstruction } from '../cortex-adapt/promptAdapter'
import refineData, { RefineInput, RefineOutput } from '../cortex-refine/refineEngine'

export interface CortexAdaptContext {
  userId?: string
  profile?: any
  behavior?: any
  requestMode?: string
}

export interface CortexAdaptResult {
  profile: any
  cognitiveState: any
  decision: any
  systemInstruction: string
}

export interface CortexAdaptHook {
  analyze: (input: string, context?: CortexAdaptContext) => CortexAdaptResult | Promise<CortexAdaptResult>
}

export interface CortexRefineHook {
  refine: (input: RefineInput | string, context?: Partial<RefineInput>) => RefineOutput | Promise<RefineOutput>
}

export interface HookCollection {
  adapt: CortexAdaptHook
  refine: CortexRefineHook
}

const DEFAULT_BEHAVIOR = {
  repeatedConfusionCount: 0,
  recentFollowUps: 0,
  recentQuestionRatio: 0,
  avgMessageLength: 0,
  confusionDelta: 0,
  engagementDelta: 0,
  boredomSignal: 0,
  quickUnderstandingSignal: 0,
}

export async function runCortexAdapt(input: string, context: CortexAdaptContext = {}): Promise<CortexAdaptResult> {
  const profile = context.profile || await getOrCreateProfile(context.userId || 'anonymous')
  const behavior = {
    ...DEFAULT_BEHAVIOR,
    ...context.behavior,
    avgMessageLength: context.behavior?.avgMessageLength ?? input.length,
  }
  const cognitiveState = estimateCognitiveState(profile, behavior)
  const decision = decideAdaptation(profile, cognitiveState, { requestMode: context.requestMode || 'default' })
  const systemInstruction = toSystemInstruction(decision, profile)

  return { profile, cognitiveState, decision, systemInstruction }
}

export function runCortexRefine(input: RefineInput | string, context: Partial<RefineInput> = {}): RefineOutput {
  const refineInput: RefineInput = typeof input === 'string'
    ? { query: context.query || '', rawAiContext: input, rawWebResults: context.rawWebResults }
    : { ...context, ...input }

  return refineData(refineInput)
}

export const cortexHooks: HookCollection = {
  adapt: { analyze: runCortexAdapt },
  refine: { refine: runCortexRefine },
}

export default cortexHooks
