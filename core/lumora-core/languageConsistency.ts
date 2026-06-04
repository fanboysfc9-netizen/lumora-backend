/** Lightweight, dependency-free language detection and consistency helpers. */

const STOPWORDS: Record<string, string[]> = {
  en: ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with'],
  es: ['el', 'la', 'que', 'y', 'en', 'los', 'se', 'del', 'las', 'por', 'un', 'para'],
  fr: ['le', 'la', 'et', 'les', 'des', 'que', 'qui', 'un', 'une', 'pour', 'dans'],
  nl: ['de', 'het', 'een', 'en', 'van', 'ik', 'je', 'niet', 'dat', 'het'],
  de: ['der', 'die', 'und', 'das', 'ist', 'ich', 'nicht', 'zu', 'den']
}

export function detectLanguage(text: string): string {
  if (!text || !text.trim()) return 'en'
  const lower = text.toLowerCase()
  const counts: Record<string, number> = {}
  for (const lang of Object.keys(STOPWORDS)) {
    counts[lang] = 0
    for (const sw of STOPWORDS[lang]) {
      if (lower.includes(` ${sw} `) || lower.startsWith(`${sw} `) || lower.endsWith(` ${sw}`)) counts[lang]++
    }
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  if (!best) return 'en'
  const [lang, score] = best
  // require at least 1 stopword match and a clear lead
  const second = Object.entries(counts).sort((a, b) => b[1] - a[1])[1]
  if (score >= 2 && (!second || score - (second[1] || 0) >= 1)) return lang
  // fallback check: presence of common punctuation for Spanish inverted question
  if (text.includes('¿') || text.includes('¡')) return 'es'
  return 'en'
}

export function isLanguageMismatch(userLang: string | undefined, outputText: string): { mismatch: boolean; detected: string } {
  const detected = detectLanguage(outputText)
  const user = (userLang || 'en').slice(0,2).toLowerCase()
  if (!user) return { mismatch: false, detected }
  const match = detected === user
  return { mismatch: !match, detected }
}

export default { detectLanguage, isLanguageMismatch }
