export interface RefineInput {
  query: string
  rawWebResults?: any[]
  rawAiContext?: string
}

export interface RefineOutput {
  cleanedSummary: string
  facts: string[]
  keyPoints: string[]
  tables?: string[]
  removedNoise: string[]
  contradictionsDetected: boolean
  reliabilityScore: number
}

const AD_KEYWORDS = /\b(buy now|discount|offer|sale|shop|pricing|order now|subscribe|free trial|limited time|click here|buy|order|shop now)\b/i
const OPINION_KEYWORDS = /\b(i think|in my opinion|may|might|could|probably|likely|suggests|suggested|we believe)\b/i
const CTA_KEYWORDS = /\b(learn more|click here|download now|sign up|subscribe)\b/i

function clamp(v: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, v))
}

function stripHtml(s?: string) {
  if (!s) return ''
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function removeUrls(s?: string) {
  if (!s) return ''
  return s.replace(/https?:\/\/[^\s]+/g, '').replace(/www\.[^\s]+/g, '')
}

function normalizeWhitespace(s?: string) {
  if (!s) return ''
  return s.replace(/\s+/g, ' ').trim()
}

function sanitizeText(s?: string) {
  if (!s) return ''
  let t = String(s)
  t = stripHtml(t)
  t = removeUrls(t)
  t = t.replace(/[\u200B-\u200F]/g, '')
  t = normalizeWhitespace(t)
  return t
}

function isAdContent(text?: string) {
  if (!text) return false
  return AD_KEYWORDS.test(text) || CTA_KEYWORDS.test(text)
}

function extractDomain(link?: string, domainField?: string) {
  if (domainField && typeof domainField === 'string' && domainField.trim()) return domainField
  if (!link || typeof link !== 'string') return ''
  try {
    const u = new URL(link)
    return u.hostname.replace(/^www\./, '')
  } catch (e) {
    return ''
  }
}

function scoreDomain(domain: string) {
  if (!domain) return 0.5
  const d = domain.toLowerCase()
  if (d.includes('wikipedia.org')) return 0.95
  if (d.endsWith('.gov') || d.endsWith('.edu')) return 0.92
  if (d.includes('nytimes') || d.includes('bbc') || d.includes('theguardian') || d.includes('cnn') || d.includes('reuters')) return 0.9
  if (d.includes('medium') || d.includes('blog') || d.includes('wordpress') || d.includes('tumblr')) return 0.35
  if (d.includes('press') || d.includes('pressrelease') || d.includes('advertise')) return 0.3
  return 0.6
}

function clarityScore(text: string) {
  if (!text) return 0.2
  const len = text.length
  let s = 0.5
  if (len > 200) s = 0.9
  else if (len > 120) s = 0.8
  else if (len > 60) s = 0.65
  if (/\d/.test(text)) s = clamp(s + 0.1)
  return s
}

function extractFactsFromText(text: string): string[] {
  const t = sanitizeText(text)
  if (!t) return []
  const parts = t.split(/[\n\r\.;!\?•\u2022\-–—]+/).map(p => p.trim()).filter(Boolean)
  const facts: string[] = []
  for (let part of parts) {
    if (!part) continue
    if (part.length < 12) continue
    if (OPINION_KEYWORDS.test(part)) continue
    if (isAdContent(part)) continue
    if (!/(\bis\b|\bare\b|\bwas\b|\bwere\b|\bfounded\b|\bestablished\b|\blocated\b|\bbased\b|\bhas\b|\bprovides\b|\boffers\b|\bprogram\b|\bcompany\b|\bCEO\b|\bpopulation\b|\bpercent\b|\d{4})/i.test(part)) {
      continue
    }

    const commas = part.split(/,|;| and | & /).map(s => s.trim()).filter(Boolean)
    if (commas.length > 1 && commas.length <= 6) {
      for (const c of commas) {
        if (c.length >= 12 && !OPINION_KEYWORDS.test(c) && !isAdContent(c)) facts.push(normalizeWhitespace(c))
      }
    } else {
      facts.push(normalizeWhitespace(part))
    }
  }

  const seen = new Set<string>()
  const out: string[] = []
  for (const f of facts) {
    const key = f.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(f)
  }
  return out
}

function factSignature(fact: string) {
  let s = fact.toLowerCase()
  s = s.replace(/https?:\/\/[^\s]+/g, '')
  s = s.replace(/\b\d{4}\b/g, 'YEAR')
  s = s.replace(/\b\d+(?:[.,]\d+)?%?\b/g, 'NUM')
  s = s.replace(/[^a-z0-9\s]/g, '')
  s = s.replace(/\b(the|a|an|of|in|on|at|for|to|by|with)\b/g, '')
  s = s.replace(/\s+/g, ' ').trim()
  const words = s.split(' ').filter(Boolean)
  return words.slice(0, 8).join(' ')
}

export function refineData(input: RefineInput): RefineOutput {
  const query = input?.query || ''
  const rawWeb = Array.isArray(input?.rawWebResults) ? input!.rawWebResults! : []
  const rawAi = typeof input?.rawAiContext === 'string' ? input!.rawAiContext! : ''

  const removedNoise: string[] = []

  const normalized: { text: string; domain: string; date?: string | null; raw: any }[] = []
  const seenKeys = new Set<string>()
  for (const r of rawWeb) {
    const title = sanitizeText(r?.title || r?.name || r?.heading || '')
    const snippet = sanitizeText(r?.snippet || r?.description || r?.excerpt || '')
    const combined = normalizeWhitespace([title, snippet].filter(Boolean).join(' - '))
    if (!combined) continue
    if (isAdContent(combined)) {
      removedNoise.push(`ad-like content removed: ${combined.slice(0, 120)}`)
      continue
    }
    const domain = extractDomain(r?.link, r?.domain)
    const key = combined.toLowerCase().replace(/\s+/g, ' ').slice(0, 300)
    if (seenKeys.has(key)) {
      removedNoise.push(`duplicate removed: ${combined.slice(0, 120)}`)
      continue
    }
    seenKeys.add(key)
    normalized.push({ text: combined, domain, date: r?.date || r?.published_at || r?.time || null, raw: r })
  }

  if (rawAi && rawAi.trim()) {
    const t = sanitizeText(rawAi)
    if (t) normalized.push({ text: t, domain: 'ai-context', date: null, raw: { source: 'ai' } })
  }

  const factCandidates: { fact: string; sourceDomain: string; sourceDate?: string | null; sourceReliability: number }[] = []
  for (const n of normalized) {
    const facts = extractFactsFromText(n.text)
    const domainScore = scoreDomain(n.domain || '')
    const clarity = clarityScore(n.text)
    const sourceReliability = clamp(domainScore * 0.75 + clarity * 0.25)
    for (const f of facts) {
      factCandidates.push({ fact: f, sourceDomain: n.domain || '', sourceDate: n.date || null, sourceReliability })
    }
  }

  const factMap = new Map<string, { fact: string; sources: { domain: string; date?: string | null; reliability: number }[] }>()
  for (const c of factCandidates) {
    const key = c.fact.toLowerCase()
    if (!factMap.has(key)) factMap.set(key, { fact: c.fact, sources: [] })
    factMap.get(key)!.sources.push({ domain: c.sourceDomain, date: c.sourceDate, reliability: c.sourceReliability })
  }

  const prelimFacts: { fact: string; reliability: number; signature: string; sources: { domain: string; date?: string | null; reliability: number }[] }[] = []
  for (const [k, v] of factMap.entries()) {
    const avgReli = v.sources.reduce((s, x) => s + x.reliability, 0) / Math.max(1, v.sources.length)
    const sig = factSignature(v.fact)
    prelimFacts.push({ fact: v.fact, reliability: clamp(avgReli), signature: sig, sources: v.sources })
  }

  const signatures = new Map<string, typeof prelimFacts>()
  for (const pf of prelimFacts) {
    const arr = signatures.get(pf.signature) || []
    arr.push(pf)
    signatures.set(pf.signature, arr)
  }

  let contradictionsDetected = false
  const finalFactsMap = new Map<string, { fact: string; reliability: number }>()

  for (const [sig, group] of signatures.entries()) {
    if (group.length === 1) {
      const one = group[0]
      finalFactsMap.set(one.fact.toLowerCase(), { fact: one.fact, reliability: one.reliability })
      continue
    }

    const uniqueFacts = Array.from(new Map(group.map(g => [g.fact.toLowerCase(), g])).values())
    if (uniqueFacts.length <= 1) {
      const keep = uniqueFacts[0]
      finalFactsMap.set(keep.fact.toLowerCase(), { fact: keep.fact, reliability: keep.reliability })
      continue
    }

    uniqueFacts.sort((a, b) => {
      if (b.reliability !== a.reliability) return b.reliability - a.reliability
      return a.fact.localeCompare(b.fact)
    })
    const winner = uniqueFacts[0]
    finalFactsMap.set(winner.fact.toLowerCase(), { fact: winner.fact, reliability: winner.reliability })
    for (let i = 1; i < uniqueFacts.length; i++) {
      contradictionsDetected = true
      removedNoise.push(`contradictory fact removed: "${uniqueFacts[i].fact}" (kept: "${winner.fact}")`)
    }
  }

  const finalFacts = Array.from(finalFactsMap.values())
  finalFacts.sort((a, b) => {
    if (b.reliability !== a.reliability) return b.reliability - a.reliability
    return a.fact.localeCompare(b.fact)
  })

  const facts = finalFacts.map(f => f.fact)
  const keyPoints = finalFacts.slice(0, 3).map(f => f.fact)

  const predicateCounts = new Map<string, { subject: string; object: string; reliability: number }[]>()
  const predRegex = /^(.+?)\s+(is|are|was|were|has|have|founded|established|based|located|offers|provides|launched|released|became|named)\b\s*(.*)$/i
  for (const f of finalFacts) {
    const m = f.fact.match(predRegex)
    if (m) {
      const subject = m[1].trim()
      const predicate = m[2].toLowerCase()
      const object = m[3].trim()
      const arr = predicateCounts.get(predicate) || []
      arr.push({ subject, object, reliability: f.reliability })
      predicateCounts.set(predicate, arr)
    }
  }

  const tables: string[] = []
  for (const [pred, rows] of predicateCounts.entries()) {
    if (rows.length >= 2) {
      const header = `Entity | Predicate | Value`
      const lines = rows.map(r => `${r.subject} | ${pred} | ${r.object}`)
      tables.push([header, ...lines].join('\n'))
    }
  }

  let cleanedSummary = ''
  if (facts.length === 0) {
    cleanedSummary = ''
  } else if (facts.length === 1) {
    cleanedSummary = `${facts[0]}`
  } else {
    const top = facts.slice(0, 5)
    cleanedSummary = top.map(f => `- ${f}`).join('\n')
  }

  const reliabilityScore = finalFacts.length === 0 ? 0 : clamp(finalFacts.reduce((s, x) => s + x.reliability, 0) / finalFacts.length)

  return {
    cleanedSummary,
    facts,
    keyPoints,
    tables: tables.length ? tables : undefined,
    removedNoise,
    contradictionsDetected,
    reliabilityScore: clamp(reliabilityScore)
  }
}

export default refineData
