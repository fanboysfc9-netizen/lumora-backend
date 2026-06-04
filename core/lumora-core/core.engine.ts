import { normalizeInput } from './input.normalizer'
import { buildPromptPackage } from './prompt.builder'
import { CoreOutput, ProcessOptions } from './types'
import { applyNaturalness } from './naturalnessLayer'
import { isLanguageMismatch, detectLanguage } from './languageConsistency'

type PostProcessResult = {
  explanation: string
  intuition?: string
  steps?: string[]
  example?: string
  recap?: string
  raw?: string
  formatted?: string
  languageMismatch?: boolean
  detectedLanguage?: string
}

/**
 * Main Core engine: transforms raw user input into an AI-ready prompt package.
 * - Stateless
 * - No external API calls
 * - No final answer generation
 */
export function processInput(rawInput: string, options?: ProcessOptions): CoreOutput {
  const normalized = normalizeInput(rawInput)

  const userLevel = options?.userLevel || 'average'
  const strictness = options?.strictness || 'moderate'
  const difficulty = options?.difficulty
  const maxLines = options?.maxLines || (normalized.tokens < 12 ? 6 : normalized.tokens < 60 ? 8 : 12)

  const pkg = buildPromptPackage(normalized, { userLevel, strictness, maxLines, difficulty })

  const promptPackageString = JSON.stringify({ prompt: pkg.prompt, metadata: pkg.metadata })

  const confidence = Math.max(0, Math.min(1, normalized.confidence || 0))
  const needsAdaptation = !!(confidence < 0.6 || normalized.subjectHints.length === 0)

  const out: CoreOutput = {
    rawInput: normalized.raw,
    intent: normalized.intent,
    subject: pkg.metadata.subject,
    promptPackage: promptPackageString,
    metadata: {
      confidence,
      needsAdaptation,
    },
  }

  return out
}

export default { processInput }

/** Build a simple prompt for API consumers (keeps compatibility with existing apps/api usage) */
export function buildPromptForApi(input: { question: string; userLevel?: any; strictness?: any; maxLines?: number; difficulty?: any }) {
  const normalized = normalizeInput(input.question || '')
  const pkg = buildPromptPackage(normalized, { userLevel: input.userLevel, strictness: input.strictness, maxLines: input.maxLines, difficulty: input.difficulty })
  return { prompt: pkg.prompt, metadata: pkg.metadata }
}

/** Post-process raw model output into a structured, natural-looking result. */
export function postProcessResponse(rawText: string, opts?: { userLanguage?: string; preferSections?: boolean }): PostProcessResult {
  const t = (rawText || '').replace(/\r\n/g, '\n').trim()

  // Basic parse for labeled sections
  const sections: Record<string, string> = {}
  const lines = t.split('\n')
  let lastKey: string | null = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = (/^(Explanation|Why it works|Intuition|Steps|Example|Recap|Summary)\s*[:\-]?\s*(.*)$/i).exec(line)
    if (m) {
      lastKey = m[1].toLowerCase()
      sections[lastKey] = (m[2] || '').trim()
      continue
    }
    if (lastKey) {
      sections[lastKey] = (sections[lastKey] || '') + '\n' + line
    }
  }

  // If no labeled sections, treat whole text as explanation but try to extract numbered steps
  let explanation = ''
  let intuition: string | undefined = undefined
  let stepsArr: string[] | undefined = undefined
  let example: string | undefined = undefined
  let recap: string | undefined = undefined

  if (sections['explanation'] || sections['why it works'] || sections['steps'] || sections['example'] || sections['recap'] || sections['intuition']) {
    explanation = (sections['explanation'] || '').trim()
    intuition = (sections['why it works'] || sections['intuition'] || '').trim() || undefined
    if (sections['steps']) {
      stepsArr = (sections['steps'] || '')
        .split(/\n|\r/)
        .map(l => l.replace(/^\s*\d+\.|^\s*[-*+]\s*/, '').trim())
        .filter(Boolean)
    }
    example = (sections['example'] || '').trim() || undefined
    recap = (sections['recap'] || sections['summary'] || '').trim() || undefined
  } else {
    // fallback: whole text as explanation; detect numbered lists as steps
    explanation = t
    const numbered = t.match(/(^|\n)\s*\d+\./m)
    if (numbered) {
      const items = t.split(/\n/).map(l => l.replace(/^\s*\d+\.|^\s*[-*+]\s*/, '').trim()).filter(Boolean)
      if (items.length > 1) {
        stepsArr = items
        // remove steps from explanation for clarity
        explanation = items.slice(0,1).join(' ')
      }
    }
  }

  // Apply naturalness smoothing
  const formatted = applyNaturalness(t, opts?.preferSections ? { useSections: true } : undefined)

  // Language consistency check
  const userLang = opts?.userLanguage
  const langCheck = isLanguageMismatch(userLang, t)

  const result: PostProcessResult = {
    explanation: explanation || formatted.split('\n')[0] || '',
    intuition: intuition,
    steps: stepsArr,
    example,
    recap,
    raw: rawText,
    formatted,
    languageMismatch: langCheck.mismatch,
    detectedLanguage: langCheck.detected,
  }

  return result
}
