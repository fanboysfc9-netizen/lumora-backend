export type Mode = 'tutor' | 'chat' | 'coach'

const tutorKeywords = ['explain', 'teach', 'how to', 'solve', 'homework', 'derivation', 'example', 'step-by-step']
const coachKeywords = ['quiz', 'test', 'practice', 'flashcard', 'revise', 'revision', 'mcq', 'quiz me', 'questionnaire']

export function classifyMode(text: string): Mode {
  const t = (text || '').toLowerCase()

  for (const kw of coachKeywords) {
    if (t.includes(kw)) return 'coach'
  }

  for (const kw of tutorKeywords) {
    if (t.includes(kw)) return 'tutor'
  }

  return 'chat'
}

export default classifyMode
