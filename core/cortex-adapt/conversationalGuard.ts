const SOCIAL_PHRASES = new Set([
  'hi',
  'hello',
  'hey',
  'thanks',
  'thank you',
  'good morning',
  'good afternoon',
  'good evening',
  'how are you'
])

const TASK_SIGNAL = /\b(what|why|how|when|where|who|which|explain|define|describe|compare|help|teach|learn|calculate|compute|solve|prove|show|tell me|write|build|debug|fix|code|example|meaning)\b/i

export function isLowIntentConversational(input: string): boolean {
  const normalized = (input || '').trim().toLowerCase().replace(/[!?.,]+$/g, '')
  if (!normalized) return true
  if (SOCIAL_PHRASES.has(normalized)) return true

  const wordCount = normalized.split(/\s+/).filter(Boolean).length
  return wordCount <= 6 && !TASK_SIGNAL.test(normalized) && !/\d/.test(normalized)
}