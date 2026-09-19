import { VerifiedAuth } from './account.service'
import projectService from './project.service'
import knowledgeRouter from 'core/cortex-adapt/knowledgeRouter'

export type PracticeKind = 'test' | 'quiz' | 'exam'

export type PracticeQuestion = {
  id: string
  topic: string
  prompt: string
  answer: string
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

  const query = `${clean(plan.subject, 'general study')} ${topicNames.slice(0, 4).join(' ')} educational concepts`
  const sources = await knowledgeRouter.fetchSerpResults(query, { timeoutMs: 3500 })
  const count = questionCount(kind)
  const questions = Array.from({ length: count }, (_, index) => {
    const topic = topicNames[index % topicNames.length]
    const source = sources[index % Math.max(1, sources.length)]
    const answer = source?.snippet || `Review ${topic} in your study plan before answering.`
    return {
      id: `${plan.id}-${index + 1}`,
      topic,
      prompt: `In your own words, explain the key idea of ${topic} and give one example.`,
      answer,
      source: source?.source
    }
  })

  return {
    plan: { id: plan.id, title: clean(plan.title, 'Study plan'), subject: clean(plan.subject, 'General') },
    kind,
    questions,
    sources
  }
}

export default { generatePractice }