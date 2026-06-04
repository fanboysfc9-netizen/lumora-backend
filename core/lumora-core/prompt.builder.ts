import { NormalizedInput, PromptPackageObject, UserLevel, Strictness, Difficulty } from './types'
import { classifyResponseType } from './responseClassifier'
import { selectResponseStructure } from './responseStructureSelector'
import { detectLanguage } from './languageConsistency'

/** Build the AI-ready prompt package (prompt + metadata) for downstream layers.
 * Implements Lumora Core v2 "Thinking-First" teaching structure and difficulty adaptation.
 */
export function buildPromptPackage(normalized: NormalizedInput, opts?: { userLevel?: UserLevel; maxLines?: number; strictness?: Strictness; difficulty?: Difficulty }): PromptPackageObject {
  const userLevel = opts?.userLevel || 'average'
  const strictness = opts?.strictness || 'moderate'

  // Auto-detect difficulty if not provided
  let difficulty: Difficulty = opts?.difficulty || (normalized.tokens < 20 ? 'easy' : normalized.tokens < 80 ? 'medium' : 'hard')

  const maxLines = opts?.maxLines ?? (difficulty === 'easy' ? 4 : difficulty === 'medium' ? 8 : 14)

  // Classify response type and choose structure
  const classification = classifyResponseType(normalized)
  const responseType = classification.responseType
  const responseStructure = selectResponseStructure(responseType, normalized)

  // Detect user language preference (simple heuristic)
  const userLang = detectLanguage(normalized.cleaned || '') || 'en'

  const instructions: string[] = []
  instructions.push('You are Lumora Core v2.5 — Adaptive Tutor Prompting Layer (do NOT answer here).')
  instructions.push('Goal: produce a single, student-facing system prompt that guides the model to teach naturally and adaptively. Do not include internal chain-of-thought.')

  // Naturalness and tone guidance (always)
  instructions.push('Style guidance: Prefer natural, conversational prose. Avoid over-formatting, excessive bolding or repeated labels. Use sections only when they add clarity.')
  instructions.push('Tutor behavior: gradual explanations, reasoning before conclusions, adaptive simplicity, gentle scaffolding, and brief examples when helpful.')

  // Response-type specific guidance
  if (responseType === 'casual' || responseType === 'conversation') {
    instructions.push('This is a conversational request — reply casually and concisely. Do NOT include steps or formal labeled sections.')
  } else if (responseType === 'definition') {
    instructions.push('This is a definition request — prefer a short explanation, a brief intuition or example, and a 1-2 line recap only if useful.')
  } else if (responseType === 'problem_solving') {
    instructions.push('This is a problem-solving request — include a concise explanation, a clear step-by-step breakdown, and at least one short example. Label steps clearly if they help readability.')
  } else if (responseType === 'conceptual') {
    instructions.push('This is a conceptual/intuitive request — lead with a simple explanation, then the intuition (why it works), then an example.')
  } else if (responseType === 'advanced_learning') {
    instructions.push('This is an advanced learning request — provide layered reasoning: short summary, intuition, detailed steps, and optional examples. Keep tone scholarly but approachable.')
  } else if (responseType === 'emotional') {
    instructions.push('This is an emotional support request — respond with empathy, validate feelings, offer brief, actionable suggestions, and avoid technical detail unless asked.')
  }

  // Language enforcement
  instructions.push(`Language: Respond in the user's language (${userLang}) only. If the user's language is unclear, default to English.`)
  instructions.push('Do NOT switch languages mid-response. Keep language consistent throughout.')

  // Formatting guidance tuned by responseStructure
  if (responseStructure.useSections) {
    instructions.push(`If sections are used, label them sparingly using these headings when helpful: ${responseStructure.sections?.join(', ') || 'Explanation, Steps, Example, Recap'}.`) 
  } else {
    instructions.push('Prefer flowing prose without rigid labeled headers; use short paragraphs and transitional phrases.')
  }

  instructions.push(`Difficulty adaptation: ${difficulty.toUpperCase()} — adapt depth and verbosity accordingly.`)
  instructions.push(`Target student level: ${userLevel}. Strictness: ${strictness}. Aim to keep concise answers near ~${maxLines} lines when possible.`)

  // Build prompt package string
  const promptLines: string[] = []
  promptLines.push('--- LUMORA CORE v2.5 PROMPT PACKAGE ---')
  promptLines.push(...instructions)
  promptLines.push('')
  promptLines.push('User question:')
  promptLines.push(normalized.raw)
  promptLines.push('')
  promptLines.push('Context:')
  promptLines.push(`Detected intent: ${normalized.intent}`)
  promptLines.push(`Detected response type: ${responseType}`)
  promptLines.push(`Subject hints: ${normalized.subjectHints.length ? normalized.subjectHints.join(', ') : 'none'}`)
  promptLines.push('')
  promptLines.push('Note: Prefer natural, adaptive tutoring voice; avoid mechanical templates unless the request demands them.')

  const prompt = promptLines.join('\n')

  const metadata = {
    userLevel,
    strictness,
    intent: normalized.intent,
    subject: normalized.subjectHints.length ? normalized.subjectHints[0] : null,
    maxLines,
    needsAdaptation: normalized.confidence < 0.6 || normalized.subjectHints.length === 0,
    difficulty,
    responseType,
    responseStructure,
    userLanguage: userLang,
  }

  return { prompt, instructions, metadata }
}

export default { buildPromptPackage }
