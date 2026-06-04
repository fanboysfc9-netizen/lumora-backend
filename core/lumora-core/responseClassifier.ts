import { NormalizedInput, ResponseType } from './types'

/**
 * Heuristic response type classifier. Returns the best-guess ResponseType and confidence.
 * This is intentionally simple and rule-driven to avoid extra dependencies.
 */
export function classifyResponseType(normalized: NormalizedInput): { responseType: ResponseType; confidence: number } {
  const s = (normalized.cleaned || '').toLowerCase()
  const tokens = normalized.tokens || 0

  // Casual / conversational shortcuts
  if (/^(hi|hello|hey|how are you|how's it going|how're you)\b/.test(s) || /tell me something|fun fact|what's up\b/.test(s)) {
    return { responseType: 'casual', confidence: 0.95 }
  }

  // Emotional support
  if (/\b(i[' ]?m|i am|i feel|i've been)\b.*\b(struggl|sad|depress|anxious|stressed|overwhelmed|scared)\b/.test(s) || /i need help|i'm struggling/.test(s)) {
    return { responseType: 'emotional', confidence: 0.95 }
  }

  // Problem solving / procedural
  if (/\b(how to|how do i|how do you|solve|calculate|compute|prove|derive|steps?)\b/.test(s) || /\bsolve for\b/.test(s)) {
    return { responseType: 'problem_solving', confidence: 0.9 }
  }

  // Definition requests
  if (/\b(what is|what's a|define|definition of|meaning of)\b/.test(s)) {
    return { responseType: 'definition', confidence: 0.9 }
  }

  // Conceptual / intuition
  if (/\b(explain|intuition|why it works|why does)\b/.test(s)) {
    return { responseType: 'conceptual', confidence: 0.88 }
  }

  // Advanced / long-form learning
  if (tokens > 80 || /\b(derive|prove|show that|advanced|rigorous|detailed proof)\b/.test(s)) {
    return { responseType: 'advanced_learning', confidence: 0.85 }
  }

  // Conversation fallback
  return { responseType: 'conversation', confidence: 0.6 }
}

export default { classifyResponseType }
