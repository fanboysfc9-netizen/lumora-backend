// Accept any mode shape here to allow different mode enums across modules
import { Mode } from './modeClassifier'

export type FormattedResponse =
  | { type: 'text'; text: string }
  | { type: 'quiz'; raw: string; items: Array<{ question: string; answer?: string }> }

export function formatResponse(text: string, mode: any): FormattedResponse {
  if (mode === 'coach') {
    const lines = (text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    const items: Array<{ question: string; answer?: string }> = []

    const questionPattern = /^(?:q[:\.\)\s]|question[:\s]|\d+\.)/i
    const answerPattern = /^(?:a[:\.\)\s]|answer[:\s])/i

    let current: { question: string; answer?: string } | null = null
    for (const line of lines) {
       if (questionPattern.test(line) || /^Q[:\s]/i.test(line)) {
        if (current) items.push(current)
        // strip leading marker (e.g., "Q1.", "Q:")
        const q = line.replace(questionPattern, '').trim()
        current = { question: q || line }
      } else if (answerPattern.test(line)) {
        const a = line.replace(answerPattern, '').trim()
        if (!current) current = { question: '' }
        current.answer = a || line
      } else {
        if (!current) current = { question: line }
        else current.question += ' ' + line
      }
    }
    if (current) items.push(current)

    return { type: 'quiz', raw: text, items }
  }

  return { type: 'text', text }
}

export default formatResponse
