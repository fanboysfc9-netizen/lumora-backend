import { ResponseStructure } from './types'

const KNOWN_LABELS = ['Explanation', 'Why it works', 'Intuition', 'Steps', 'Example', 'Recap', 'Summary']

function stripFormattingMarkers(s: string) {
  return s.replace(/\*\*(.*?)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1').replace(/\*([^\*]+)\*/g, '$1')
}

/** Parse labeled sections into a map. */
function parseLabeledSections(text: string): Record<string, string> {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const sections: Record<string, string> = {}
  let current: string | null = null
  for (let line of lines) {
    line = line.trim()
    const m = (/^(Explanation|Why it works|Intuition|Steps|Example|Recap|Summary)\s*[:\-]\s*(.*)$/i).exec(line)
    if (m) {
      current = m[1].toLowerCase()
      sections[current] = (m[2] || '').trim()
      continue
    }
    if (!current) continue
    sections[current] = (sections[current] || '') + '\n' + line
  }
  for (const k of Object.keys(sections)) sections[k] = sections[k].trim()
  return sections
}

/** Convert steps text (possibly numbered) into natural sentences. */
function naturalizeSteps(s: string) {
  const items = s.split(/\n|\r/).map(l => l.replace(/^\s*\d+\.|^\s*-\s*|^\s*\*\s*/, '').trim()).filter(Boolean)
  if (!items.length) return s
  // Join steps into a natural paragraph
  if (items.length === 1) return items[0]
  const first = items[0]
  const rest = items.slice(1).map((it, i) => `${it}${i === items.length - 2 ? '' : ''}`)
  return `${items.join('. ')}.`
}

/** Apply naturalness transformations to model output.
 * - Removes excessive markdown/bold
 * - Collapses labeled sections into natural flow when structure.useSections=false
 * - Keeps labeled sections when structure.useSections=true but reduces heavy formatting
 */
export function applyNaturalness(rawText: string, structure?: ResponseStructure): string {
  if (!rawText) return ''
  let text = stripFormattingMarkers(rawText)

  // If text contains labeled sections, parse them
  const sections = parseLabeledSections(text)

  if (!structure || !structure.useSections) {
    // prefer natural flow: join explanation + intuition + steps + example + recap
    const parts: string[] = []
    if (sections['explanation']) parts.push(sections['explanation'])
    if (sections['why it works'] || sections['intuition']) {
      const k = sections['why it works'] ? 'why it works' : 'intuition'
      const val = sections[k]
      if (val) parts.push(`Why it works: ${val}`)
    }
    if (sections['steps']) {
      const nat = naturalizeSteps(sections['steps'])
      parts.push(nat)
    }
    if (sections['example']) parts.push(`For example, ${sections['example']}`)
    if (sections['recap'] || sections['summary']) parts.push(sections['recap'] || sections['summary'])

    if (parts.length) return parts.join('\n\n')

    // no labeled sections found — do light cleanup and return
    text = text.replace(/\n{2,}/g, '\n\n').trim()
    return text
  }

  // If sections preferred, retain headings but remove heavy formatting
  // Normalize headings to single-line labels
  let out = text
  out = out.replace(/^(\*\*|__)+/gm, '')
  out = out.replace(/\n{3,}/g, '\n\n')
  return out.trim()
}

export default { applyNaturalness }
