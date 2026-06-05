import { LumoraCoreInput, LumoraCoreResponse, PromptBuildResult } from './types'
import { buildPromptForApi, postProcessResponse } from 'core/lumora-core'

export function buildPrompt(input: LumoraCoreInput): PromptBuildResult {
  return buildPromptForApi(input)
}

export function formatResponseAsText(resp: LumoraCoreResponse): string {
  const parts: string[] = []
  if (resp.explanation) parts.push(resp.explanation.trim())
  if ((resp as any).intuition) parts.push(((resp as any).intuition || '').trim())
  if (resp.steps && resp.steps.length) {
    parts.push('\nSteps:')
    resp.steps.forEach((s, i) => parts.push(`${i + 1}. ${s.trim()}`))
  }
  if (resp.example) parts.push('\nExample:')
  if (resp.example) parts.push(resp.example.trim())
  if (resp.recap) parts.push('\nRecap:')
  if (resp.recap) parts.push(resp.recap.trim())
  return parts.join('\n')
}

export function postProcess(rawText: string): LumoraCoreResponse & { _meta?: any } {
  const pp = postProcessResponse(rawText)
  const resp: any = {
    explanation: pp.explanation,
    intuition: pp.intuition,
    steps: pp.steps,
    example: pp.example,
    recap: pp.recap,
    raw: pp.raw
  }
  resp._meta = { languageMismatch: pp.languageMismatch, detectedLanguage: pp.detectedLanguage, formatted: pp.formatted }
  return resp
}

export default { buildPrompt, formatResponseAsText, postProcess }
