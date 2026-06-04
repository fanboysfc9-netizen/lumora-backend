import { clamp } from './scoringSystem'
import refineData from '../cortex-refine/refineEngine'

export type KnowledgeIntent =
  | 'general_knowledge'
  | 'real_time_info'
  | 'news_event'
  | 'person_lookup'
  | 'technical_explanation'
  | 'math_problem'
  | string

export interface KnowledgeDecision {
  useSerpAPI: boolean
  intent: KnowledgeIntent
  confidenceScore: number // 0..1
  webScore: number // 0..1
  webConfidenceScore?: number // alias for webScore (0..1)
  reasoning: string
}

export interface SerpSummary {
  facts: string[]
  summaryText: string
  raw?: any
  structured?: Array<{ title: string; snippet: string; source?: string }>
}

// Simple in-memory LRU cache for Serp summaries
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes
const CACHE_MAX = 200
const serpCache: Map<string, { summary: SerpSummary; ts: number }> = new Map()

function cacheKey(q: string) {
  return q.trim().toLowerCase()
}

function getCachedSummary(q: string): SerpSummary | null {
  const k = cacheKey(q)
  const entry = serpCache.get(k)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    serpCache.delete(k)
    return null
  }
  // refresh LRU order
  serpCache.delete(k)
  serpCache.set(k, entry)
  return entry.summary
}

function setCachedSummary(q: string, summary: SerpSummary) {
  const k = cacheKey(q)
  serpCache.set(k, { summary, ts: Date.now() })
  // evict oldest if over capacity
  while (serpCache.size > CACHE_MAX) {
    const firstKey = serpCache.keys().next().value
    if (!firstKey) break
    serpCache.delete(firstKey)
  }
}

const TIME_KEYWORDS = /\b(latest|today|current|now|recent|this week|this month|breaking|update)\b/i
const NEWS_KEYWORDS = /\b(news|breaking|alert|update|headline)\b/i
const SPORTS_KEYWORDS = /\b(score|vs\b|beat|lost|won|result|final|match)\b/i
const PERSON_LOOKUP = /\b(who is|who was|tell me about|biography|born|died)\b/i
const MATH_KEYWORDS = /\b(calculate|solve|integral|derivative|sum|add|subtract|multiply|divide|what is)\b/i
const TECH_KEYWORDS = /\b(how to|implement|setup|configure|example|code|library|framework)\b/i
const PRICE_KEYWORDS = /\b(price|cost|rate|how much|worth|value)\b/i
const DEFINITION_KEYWORDS = /\b(define|definition|meaning of|what is)\b/i

function classifyIntent(input: string): KnowledgeIntent {
  const t = input || ''
  if (PERSON_LOOKUP.test(t)) return 'person_lookup'
  if (NEWS_KEYWORDS.test(t) || /\b(breaking|headline|news)\b/i.test(t)) return 'news_event'
  if (TIME_KEYWORDS.test(t)) return 'real_time_info'
  if (SPORTS_KEYWORDS.test(t)) return 'real_time_info'
  if (MATH_KEYWORDS.test(t)) return 'math_problem'
  if (TECH_KEYWORDS.test(t)) return 'technical_explanation'
  return 'general_knowledge'
}

function computeConfidence(input: string): number {
  const s = (input || '').toLowerCase()
  let score = 0.6
  // known topics boost
  const known = ['math', 'algebra', 'calculus', 'javascript', 'python', 'react', 'node', 'history', 'geography']
  for (const k of known) if (s.includes(k)) score = Math.max(score, 0.8)

  // time-sensitive lowers confidence
  if (TIME_KEYWORDS.test(s)) score = Math.min(score, 0.45)

  // person lookups on unknown entities will be lower (heuristic)
  if (PERSON_LOOKUP.test(s)) score = Math.min(score, 0.3)

  return clamp(score)
}

function computeWebScore(input: string, intent: KnowledgeIntent, confidence: number) {
  let webScore = 0
  const s = input || ''
  if (TIME_KEYWORDS.test(s)) webScore += 0.4
  if (NEWS_KEYWORDS.test(s)) webScore += 0.5
  if (SPORTS_KEYWORDS.test(s)) webScore += 0.6
  if (PRICE_KEYWORDS.test(s)) webScore += 0.7
  if (DEFINITION_KEYWORDS.test(s)) webScore += 0.35
  if (intent === 'person_lookup') webScore += 0.4
  if (confidence < 0.5) webScore += 0.5
  return clamp(webScore)
}

async function callSerpAPI(query: string, opts: { timeoutMs?: number } = {}) {
  const key = process.env.SERP_API_KEY || process.env.SERPAPI_KEY || ''
  if (!key) {
    // No key configured — caller should treat as non-fatal and fallback to Groq-only
    return null
  }

  const url = new URL('https://serpapi.com/search.json')
  url.searchParams.set('q', query)
  url.searchParams.set('api_key', key)
  url.searchParams.set('engine', 'google')
  url.searchParams.set('num', '10')

  const controller = new AbortController()
  const timeout = opts.timeoutMs || 2500
  const id = setTimeout(() => controller.abort(), timeout)

  try {
    const res = await fetch(url.toString(), { signal: controller.signal })
    clearTimeout(id)
    if (!res.ok) throw new Error(`SerpAPI HTTP ${res.status}`)
    const j = await res.json()
    return j
  } catch (e) {
    clearTimeout(id)
    // bubble up error to caller — caller should handle fallback
    throw e
  }
}

function cleanSerpResults(raw: any): string[] {
  const facts: string[] = []
  const seen = new Set<string>()

  const organic = raw?.organic_results || raw?.organic_results || raw?.organic || []
  for (const r of organic) {
    if (!r) continue
    const title = (r.title || r.name || '').trim()
    const snippet = (r.snippet || r.snippet_text || r.snippet || r.description || '').trim()
    const text = snippet ? `${title}: ${snippet}` : title
    const key = text.toLowerCase().replace(/\s+/g, ' ').slice(0, 200)
    if (!text) continue
    if (seen.has(key)) continue
    seen.add(key)
    facts.push(text)
    if (facts.length >= 5) break
  }

  // fallback to general results
  if (facts.length === 0 && Array.isArray(raw?.knowledge_graph?.description ? [raw.knowledge_graph.description] : [])) {
    const val = raw?.knowledge_graph?.description
    if (val) facts.push(String(val))
  }

  return facts
}

function structuredCleanResults(raw: any) {
  const out: Array<{ title: string; snippet: string; source?: string }> = []
  const seen = new Set<string>()
  const organic = raw?.organic_results || raw?.organic || raw?.organicResults || raw?.top_results || []
  const promoRegex = /\b(buy|shop|discount|promo|sale|coupon|order now|subscribe)\b/i
  for (const r of organic) {
    if (!r) continue
    const title = (r.title || r.name || r.positioned_title || '').trim()
    const snippet = (r.snippet || r.snippet_text || r.description || r.excerpt || '').trim()
    const source = (r.link || r.link || r.source || r.displayed_link || r.domain || r.domain?.name || '').trim()
    const key = ((r.link || title || snippet) + '').toLowerCase().replace(/\s+/g, ' ').slice(0, 240)
    if (!title && !snippet) continue
    if (seen.has(key)) continue
    // filter obvious promo/spam
    if (promoRegex.test(title) || promoRegex.test(snippet)) continue
    seen.add(key)
    out.push({ title: title || snippet, snippet: snippet || title, source: source || undefined })
    if (out.length >= 5) break
  }
  return out
}

export async function fetchSerpResults(query: string, opts: { timeoutMs?: number } = {}) {
  try {
    const raw = await callSerpAPI(query, opts)
    if (!raw) return []
    const structured = structuredCleanResults(raw)
    return structured
  } catch (e) {
    // treat as non-fatal — return empty array so caller falls back
    console.debug('[knowledgeRouter] fetchSerpResults failed (non-fatal):', (e as any)?.message || e)
    return []
  }
}

export async function routeQuery(userInput: string): Promise<KnowledgeDecision> {
  const intent = classifyIntent(userInput)
  const confidenceScore = computeConfidence(userInput)
  const webScore = computeWebScore(userInput, intent, confidenceScore)
  const webConfidenceScore = clamp(webScore)

  // Determine use per rules: >0.75 MUST use; 0.4-0.75 optional; <0.4 skip
  const hasKey = !!(process.env.SERP_API_KEY || process.env.SERPAPI_KEY)
  let useSerpAPI = false
  if (webConfidenceScore > 0.75 && hasKey) useSerpAPI = true
  else if (webConfidenceScore >= 0.4 && webConfidenceScore <= 0.75 && hasKey) useSerpAPI = false // optional — caller may choose
  else useSerpAPI = false

  // Debug logs for diagnostics
  try { console.debug('CORTEX_ROUTER_SCORE:', webConfidenceScore) } catch (e) {}
  try { console.debug('SERPAPI_KEY_PRESENT:', hasKey) } catch (e) {}

  const reasons: string[] = []
  if (TIME_KEYWORDS.test(userInput)) reasons.push('time-sensitive keywords')
  if (NEWS_KEYWORDS.test(userInput)) reasons.push('news-related keywords')
  if (SPORTS_KEYWORDS.test(userInput)) reasons.push('sports-related keywords')
  if (PERSON_LOOKUP.test(userInput)) reasons.push('person lookup detected')
  if (confidenceScore < 0.5) reasons.push('low local confidence')

  return {
    useSerpAPI,
    intent,
    confidenceScore: clamp(confidenceScore),
    webScore: clamp(webScore),
    webConfidenceScore,
    reasoning: reasons.join('; ') || 'heuristic'
  }
}

export async function fetchAndSummarize(userInput: string): Promise<SerpSummary | null> {
  // Try cache first
  try {
    const cached = getCachedSummary(userInput)
    if (cached) return cached

    const raw = await callSerpAPI(userInput, { timeoutMs: 3500 })

    if (!raw) {
      // missing key or early bail — return null so callers fallback to Groq-only
      console.debug('[knowledgeRouter] SerpAPI not available or no key configured — skipping web fetch')
      return null
    }

    // Prepare raw results array for the refine engine
    const rawList = raw?.organic_results || raw?.organic || raw?.organicResults || raw?.top_results || []
    const structured = structuredCleanResults(raw)

    // Run deterministic refinement on the raw web results
    let refined = null
    try {
      refined = refineData({ query: userInput, rawWebResults: rawList, rawAiContext: undefined })
    } catch (re) {
      // If refinement fails, fall back to basic cleaning
      console.warn('[knowledgeRouter] refineData failed (non-fatal):', (re as any)?.message || re)
    }

    if (refined && Array.isArray(refined.facts) && refined.facts.length > 0 && refined.reliabilityScore > 0.15) {
      const facts = refined.facts.slice(0, 5)
      const summaryText = refined.cleanedSummary || facts.map(f => `- ${f}`).join('\n')
      const out: SerpSummary = { facts, summaryText, raw: undefined, structured }
      try { setCachedSummary(userInput, out) } catch (e) { /* swallow cache errors */ }
      return out
    }

    // Fallback: use legacy cleaning if refinement produced nothing reliable
    const facts = cleanSerpResults(raw)
    if ((!facts || facts.length === 0) && structured && structured.length > 0) {
      // synthesize small fact-style bullets from structured results
      const synth = structured.slice(0, 5).map(s => `${s.title}${s.snippet ? ` — ${s.snippet}` : ''}${s.source ? ` (${s.source})` : ''}`)
      const summaryText = synth.map(f => `- ${f}`).join('\n')
      const out: SerpSummary = { facts: synth, summaryText, raw: undefined, structured }
      try { setCachedSummary(userInput, out) } catch (e) { /* swallow cache errors */ }
      return out
    }
    if (!facts || facts.length === 0) return null
    const summaryText = facts.slice(0, 5).map(f => `- ${f}`).join('\n')
    const out: SerpSummary = { facts, summaryText, raw: undefined, structured }
    try { setCachedSummary(userInput, out) } catch (e) { /* swallow cache errors */ }
    return out
  } catch (e) {
    // Non-fatal — if SerpAPI fails, silently fallback to Groq-only
    console.debug('[knowledgeRouter] fetchAndSummarize failed (non-fatal):', (e as any)?.message || e)
    return null
  }
}

export function buildExternalKnowledgeSection(summary: SerpSummary | null | undefined) {
  if (!summary) return ''
  // Prefer explicit facts array; fall back to summaryText bullets
  const lines: string[] = Array.isArray(summary.facts) && summary.facts.length
    ? summary.facts.slice(0, 5)
    : (summary.summaryText ? summary.summaryText.split(/\r?\n/).map(l => l.replace(/^\s*-+\s*/, '').trim()).filter(Boolean) : [])
  if (!lines || lines.length === 0) return ''
  const bullets = lines.slice(0, 5).map(l => l.startsWith('-') ? l : `- ${l}`)
  return `External Knowledge (verified):\n${bullets.join('\n')}\n\n`
}

export default { routeQuery, fetchAndSummarize, fetchSerpResults, buildExternalKnowledgeSection }
