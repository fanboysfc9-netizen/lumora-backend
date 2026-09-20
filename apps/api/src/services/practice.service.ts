import { VerifiedAuth } from './account.service'
import projectService from './project.service'
import knowledgeRouter from 'core/cortex-adapt/knowledgeRouter'
import groqService from './groq.service'

export type PracticeKind = 'test' | 'quiz' | 'exam'

export type PracticeQuestion = {
  id: string
  topic: string
  prompt: string
  answer: string
  verification: string
  source?: string
}

export type PracticePacket = {
  plan: { id: string; title: string; subject: string }
  kind: PracticeKind
  questions: PracticeQuestion[]
  sources: Array<{ title: string; snippet: string; source?: string }>
}

function clean(value: unknown, fallback = '') {
  return String(value || '').trim() || fallback
}

function questionCount(kind: PracticeKind) {
  return kind === 'exam' ? 8 : kind === 'test' ? 6 : 4
}

export async function generatePractice(auth: VerifiedAuth, planId: string, kind: PracticeKind): Promise<PracticePacket> {
  const plan = await projectService.getStudyPlan(auth, planId)
  if (!plan) throw new Error('study plan not found')

  const topics = (plan.study_plan_topics || []).filter((topic: any) => !topic.completed)
  const topicNames = (topics.length ? topics : plan.study_plan_topics || [])
    .map((topic: any) => clean(topic.title))
    .filter(Boolean)
    .slice(0, 8)
  if (!topicNames.length) throw new Error('study plan has no topics')

  const count = questionCount(kind)
  const query = `${clean(plan.subject, 'general study')} ${topicNames.slice(0, 4).join(' ')} educational concepts`
  const sources = await knowledgeRouter.fetchSerpResults(query, { timeoutMs: 3500 })
  const sourceContext = sources.slice(0, 4).map((source) => `${source.title}: ${source.snippet}`).join('\n')
  const prompt = `Create a ${kind} practice set for a learner. Return ONLY valid JSON with this shape: {"questions":[{"topic":"string","prompt":"string","answer":"string","verification":"string"}]}. Create exactly ${count} questions using these study-plan topics: ${topicNames.join(', ')}. Each answer must be correct, concise, and self-contained. Verification must briefly explain why the answer is correct. Use this optional research context only when relevant:\n${sourceContext}`
  const result = await groqService.createChatCompletion([{ role: 'system', content: 'You generate precise educational assessment JSON. Never include Markdown fences or commentary.' }, { role: 'user', content: prompt }], { mode: 'standard' })
  let generated: any = null
  try { generated = JSON.parse(String(result.text || '').replace(/^```json\s*|```$/g, '').trim()) } catch {}
  const questions = Array.isArray(generated?.questions) ? generated.questions.slice(0, count).map((question: any, index: number) => ({ id: `${plan.id}-${index + 1}`, topic: clean(question.topic, topicNames[index % topicNames.length]), prompt: clean(question.prompt, `Explain ${topicNames[index % topicNames.length]}.`), answer: clean(question.answer, 'Review this topic in your study plan.'), verification: clean(question.verification, 'Compare your answer with the explanation and key terms in your study plan.') })) : []
  if (questions.length < count) throw new Error('practice model returned an incomplete set')

  return {
    plan: { id: plan.id, title: clean(plan.title, 'Study plan'), subject: clean(plan.subject, 'General') },
    kind,
    questions,
    sources
  }
}

export default { generatePractice }