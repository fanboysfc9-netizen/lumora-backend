import { Intent, NormalizedInput } from './types'

/** Clean and normalize raw user text for downstream processing. */
export function cleanText(raw: string): string {
  if (!raw) return ''
  let s = raw.replace(/[\u2018\u2019\u201C\u201D]/g, "'")
  s = s.replace(/\s+/g, ' ')
  s = s.trim()
  return s
}

/** Heuristic intent detection using keywords and punctuation. Returns intent and confidence. */
export function detectIntent(cleaned: string): { intent: Intent; confidence: number } {
  const t = (cleaned || '').trim()
  if (!t) return { intent: 'unknown', confidence: 0.0 }
  const lower = t.toLowerCase()

  // Strong signals
  if (/[?]$/.test(t) || /^(who|what|when|where|why|how|is|are|do|does|did)\b/.test(lower)) {
    return { intent: 'question', confidence: 0.92 }
  }

  if (/\b(solving|solve|calculate|compute|evaluate|simplify|prove|find|derive)\b/.test(lower)) {
    return { intent: 'problem', confidence: 0.9 }
  }

  if (/\b(explain|describe|define|what is|tell me about)\b/.test(lower)) {
    return { intent: 'explanation', confidence: 0.88 }
  }

  if (/^(list|give|show|create|write|make)\b/.test(lower)) {
    return { intent: 'command', confidence: 0.82 }
  }

  // fallback guess
  return { intent: 'question', confidence: 0.6 }
}

/** Extract subject hints from simple keyword matching. */
export function extractSubjectHints(cleaned: string): string[] {
  const map: Record<string, string[]> = {
    math: ['math', 'algebra', 'calculus', 'geometry', 'integral', 'derivative', 'equation', 'probability', 'statistics'],
    physics: ['physics', 'force', 'velocity', 'acceleration', 'momentum', 'energy', 'quantum', 'relativity'],
    chemistry: ['chemistry', 'molecule', 'atom', 'reaction', 'acid', 'base', 'ph', 'stoichiometry'],
    biology: ['biology', 'cell', 'dna', 'gene', 'genetics', 'evolution', 'organism'],
    programming: ['code', 'program', 'javascript', 'python', 'function', 'variable', 'loop', 'algorithm', 'compile'],
    english: ['grammar', 'sentence', 'verb', 'noun', 'essay', 'writing', 'literature'],
    history: ['history', 'war', 'revolution', 'empire', 'timeline'],
    geography: ['geography', 'map', 'country', 'capital'],
  }
  const found = new Set<string>()
  const lower = (cleaned || '').toLowerCase()
  for (const [subject, kws] of Object.entries(map)) {
    for (const kw of kws) {
      if (lower.includes(kw)) { found.add(subject); break }
    }
  }
  return Array.from(found)
}

/** Main normalizer: returns cleaned text, detected intent, subject hints and confidence. */
export function normalizeInput(raw: string): NormalizedInput {
  const cleaned = cleanText(raw)
  const intentRes = detectIntent(cleaned)
  const subjects = extractSubjectHints(cleaned)
  // confidence boosted if subject present
  let confidence = intentRes.confidence
  if (subjects.length) confidence = Math.min(0.99, confidence + 0.07)
  const tokens = cleaned ? cleaned.split(/\s+/).filter(Boolean).length : 0
  return {
    raw: raw || '',
    cleaned,
    intent: intentRes.intent,
    subjectHints: subjects,
    confidence,
    tokens,
  }
}

export default { cleanText, detectIntent, extractSubjectHints, normalizeInput }
