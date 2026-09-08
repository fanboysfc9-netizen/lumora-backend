import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { VerifiedAuth } from './account.service'

export type LearningContextSelection = {
  projectId?: string | null
  studyPlanId?: string | null
}

type ProjectRecord = {
  id: string
  title: string
  description?: string | null
  subject?: string | null
  goal?: string | null
  deadline?: string | null
  status?: string | null
  progress_percent?: number | null
}

type TopicRecord = {
  id: string
  title: string
  lesson?: string | null
  exercise?: string | null
  completed?: boolean | null
  week_number?: number | null
  sort_order?: number | null
}

type StudyPlanRecord = {
  id: string
  title: string
  objective?: string | null
  subject?: string | null
  learner_level?: string | null
  deadline?: string | null
  status?: string | null
  study_plan_topics?: TopicRecord[]
}

export type LearningContext = {
  kind: 'project' | 'study_plan'
  project?: {
    id: string
    title: string
    subject: string
    goal: string
    description: string
    deadline: string | null
    status: string
    progressPercent: number
  }
  studyPlan?: {
    id: string
    title: string
    subject: string
    goal: string
    learnerLevel: string
    deadline: string | null
    status: string
    progressPercent: number
    completedCount: number
    totalCount: number
    currentTopic: string | null
    nextTopic: string | null
    completedTopics: string[]
    upcomingTopics: string[]
  }
}

function storageClient(auth: VerifiedAuth): SupabaseClient {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('Supabase learning context storage is not configured')
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${auth.accessToken}` } }
  })
}

function clean(value: unknown) {
  return String(value || '').trim()
}

export function normalizeProjectContext(project: ProjectRecord): LearningContext {
  return {
    kind: 'project',
    project: {
      id: project.id,
      title: clean(project.title),
      subject: clean(project.subject),
      goal: clean(project.goal) || clean(project.description),
      description: clean(project.description),
      deadline: project.deadline || null,
      status: clean(project.status) || 'active',
      progressPercent: Math.max(0, Math.min(100, Number(project.progress_percent) || 0))
    }
  }
}

export function normalizeStudyPlanContext(plan: StudyPlanRecord): LearningContext {
  const topics = [...(plan.study_plan_topics || [])].sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
  const completed = topics.filter((topic) => Boolean(topic.completed))
  const pending = topics.filter((topic) => !topic.completed)
  const current = pending[0] || null
  const totalCount = topics.length

  return {
    kind: 'study_plan',
    studyPlan: {
      id: plan.id,
      title: clean(plan.title),
      subject: clean(plan.subject),
      goal: clean(plan.objective),
      learnerLevel: clean(plan.learner_level) || 'beginner',
      deadline: plan.deadline || null,
      status: clean(plan.status) || 'active',
      progressPercent: totalCount ? Math.round((completed.length / totalCount) * 100) : 0,
      completedCount: completed.length,
      totalCount,
      currentTopic: current ? clean(current.title) : null,
      nextTopic: pending[1] ? clean(pending[1].title) : null,
      completedTopics: completed.map((topic) => clean(topic.title)),
      upcomingTopics: pending.map((topic) => clean(topic.title))
    }
  }
}

export function learningContextPrompt(context: LearningContext | null): string {
  if (!context) return ''
  if (context.kind === 'project' && context.project) {
    const project = context.project
    return [
      'ACTIVE LEARNING CONTEXT (use this to ground the teaching response):',
      `Project: ${project.title}`,
      `Subject: ${project.subject || 'not specified'}`,
      `Goal: ${project.goal || 'not specified'}`,
      `Description: ${project.description || 'not specified'}`,
      `Status: ${project.status}; progress: ${project.progressPercent}%`,
      project.deadline ? `Deadline: ${project.deadline}` : ''
    ].filter(Boolean).join('\n')
  }

  const plan = context.studyPlan!
  return [
    'ACTIVE LEARNING CONTEXT (use this to guide the next lesson):',
    `Study plan: ${plan.title}`,
    `Subject: ${plan.subject || 'not specified'}`,
    `Goal: ${plan.goal || 'not specified'}`,
    `Progress: ${plan.completedCount}/${plan.totalCount} items complete (${plan.progressPercent}%)`,
    `Current topic: ${plan.currentTopic || 'all items complete'}`,
    `Next topic: ${plan.nextTopic || 'none'}`,
    `Completed topics: ${plan.completedTopics.join(', ') || 'none'}`,
    `Upcoming topics: ${plan.upcomingTopics.join(', ') || 'none'}`,
    plan.deadline ? `Deadline: ${plan.deadline}` : ''
  ].filter(Boolean).join('\n')
}

export async function resolveLearningContext(auth: VerifiedAuth, selection?: LearningContextSelection | null): Promise<LearningContext | null> {
  if (!selection?.studyPlanId && !selection?.projectId) return null
  const supabase = storageClient(auth)

  if (selection.studyPlanId) {
    const { data, error } = await supabase
      .from('study_plans')
      .select('id,title,objective,subject,learner_level,deadline,status,study_plan_topics(id,title,lesson,exercise,completed,week_number,sort_order)')
      .eq('id', selection.studyPlanId)
      .eq('user_id', auth.userId)
      .maybeSingle()
    if (error) throw error
    return data ? normalizeStudyPlanContext(data as StudyPlanRecord) : null
  }

  const { data, error } = await supabase
    .from('projects')
    .select('id,title,description,subject,goal,deadline,status,progress_percent')
    .eq('id', selection.projectId)
    .eq('user_id', auth.userId)
    .maybeSingle()
  if (error) throw error
  return data ? normalizeProjectContext(data as ProjectRecord) : null
}

export default { resolveLearningContext, normalizeProjectContext, normalizeStudyPlanContext, learningContextPrompt }
