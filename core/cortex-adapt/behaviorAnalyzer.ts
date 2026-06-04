import memoryService from '../memory/memory.service'
import { BehaviorSummary } from './types'

function textSimilarity(a = '', b = '') {
  const na = a.toLowerCase().replace(/[^a-z0-9 ]+/g, '').trim()
  const nb = b.toLowerCase().replace(/[^a-z0-9 ]+/g, '').trim()
  if (!na || !nb) return 0
  if (na === nb) return 1
  return na.startsWith(nb) || nb.startsWith(na) ? 0.9 : 0
}

function containsConfusionPhrase(s: string) {
  return /i (still )?don'?t understand|i (still )?don'?t get|i keep (getting|failing)|no idea|i'm stuck|stuck on/i.test(s)
}

export async function analyzeMessageContent(message: string): Promise<BehaviorSummary> {
  // lightweight single-message heuristic
  const hasConfusion = containsConfusionPhrase(message)
  const qCount = (message.match(/\?/g) || []).length
  const len = Math.max(1, message.trim().length)
  const confusionDelta = hasConfusion ? 0.25 : 0
  const engagementDelta = qCount > 0 ? 0.05 : -0.02
  const boredomSignal = message.trim().length < 10 ? 0.2 : 0
  return {
    repeatedConfusionCount: hasConfusion ? 1 : 0,
    recentFollowUps: qCount,
    recentQuestionRatio: qCount > 0 ? 1 : 0,
    avgMessageLength: len,
    confusionDelta,
    engagementDelta,
    boredomSignal,
    quickUnderstandingSignal: 0
  }
}

export async function analyzeConversation(userId: string, conversationId?: string, window = 8): Promise<BehaviorSummary> {
  const msgs: any[] = await memoryService.getConversationHistory(userId, conversationId, window * 2)
  const last = msgs.slice(-window)
  if (!last || last.length === 0) {
    return {
      repeatedConfusionCount: 0,
      recentFollowUps: 0,
      recentQuestionRatio: 0,
      avgMessageLength: 0,
      confusionDelta: 0,
      engagementDelta: 0,
      boredomSignal: 0,
      quickUnderstandingSignal: 0
    }
  }

  let repeatedConfusion = 0
  let followUps = 0
  let qCount = 0
  let totalLen = 0
  let quickUnderstanding = 0

  // simple repeated-similarity heuristic
  for (let i = 0; i < last.length; i++) {
    const m = String(last[i].text || '')
    totalLen += m.length
    if (containsConfusionPhrase(m)) repeatedConfusion++
    qCount += (m.match(/\?/g) || []).length
    if (i > 0) {
      const sim = textSimilarity(m, String(last[i - 1].text || ''))
      if (sim > 0.9 && m.length > 1) followUps++
    }
    // very short single-message responses that are positive/ack can indicate quick understanding
    if (/ok|got it|thanks|thanks!|nice/i.test(m) && m.trim().length < 20) quickUnderstanding++
  }

  const avgLen = totalLen / last.length
  const confusionDelta = Math.min(1, repeatedConfusion * 0.15)
  const engagementDelta = Math.min(0.2, (qCount / Math.max(1, last.length)) * 0.05)
  const boredomSignal = last.length > 3 && qCount === 0 ? 0.3 : 0

  return {
    repeatedConfusionCount: repeatedConfusion,
    recentFollowUps: followUps,
    recentQuestionRatio: qCount / last.length,
    avgMessageLength: avgLen,
    confusionDelta,
    engagementDelta,
    boredomSignal,
    quickUnderstandingSignal: quickUnderstanding / last.length
  }
}
