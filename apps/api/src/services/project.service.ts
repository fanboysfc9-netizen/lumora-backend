import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { VerifiedAuth } from './account.service'

export type ProjectInput = { title: string; description?: string; subject?: string }
export type StudyPlanTopic = { week_number: number; title: string; lesson?: string; exercise?: string; sort_order?: number }
export type StudyPlanInput = {
  title: string
  objective?: string
  subject: string
  learner_level?: string
  estimated_duration?: string
  schedule?: string
  available_time?: string
  deadline?: string
  project_id?: string
  topics: StudyPlanTopic[]
}

function client(auth: VerifiedAuth): SupabaseClient {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('Supabase project storage is not configured')
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${auth.accessToken}` } }
  })
}

function requiredText(value: unknown, field: string) {
  const text = String(value || '').trim()
  if (!text) throw new Error(`${field} is required`)
  return text
}

export async function listProjects(auth: VerifiedAuth) {
  const { data, error } = await client(auth).from('projects').select('*').order('updated_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createProject(auth: VerifiedAuth, input: ProjectInput) {
  const { data, error } = await client(auth).from('projects').insert({
    user_id: auth.userId,
    title: requiredText(input.title, 'title'),
    description: String(input.description || '').trim(),
    subject: String(input.subject || '').trim()
  }).select('*').single()
  if (error) throw error
  return data
}

export async function getProject(auth: VerifiedAuth, projectId: string) {
  const { data, error } = await client(auth).from('projects').select('*').eq('id', projectId).maybeSingle()
  if (error) throw error
  return data
}

export async function listStudyPlans(auth: VerifiedAuth) {
  const { data, error } = await client(auth).from('study_plans').select('*,study_plan_topics(*)').order('updated_at', { ascending: false })
  if (error) throw error
  return data || []
}

function normalizeTopics(topics: StudyPlanTopic[]) {
  if (!Array.isArray(topics) || topics.length < 1 || topics.length > 50) throw new Error('study plan must contain 1 to 50 topics')
  return topics.map((topic, index) => ({
    week_number: Math.max(1, Number(topic.week_number) || 1),
    title: requiredText(topic.title, 'topic title').slice(0, 120),
    lesson: String(topic.lesson || '').trim().slice(0, 500),
    exercise: String(topic.exercise || '').trim().slice(0, 500),
    sort_order: index
  }))
}

export async function createStudyPlan(auth: VerifiedAuth, input: StudyPlanInput) {
  const planPayload = {
    user_id: auth.userId,
    project_id: input.project_id || null,
    title: requiredText(input.title, 'title'),
    objective: String(input.objective || '').trim(),
    subject: requiredText(input.subject, 'subject'),
    learner_level: String(input.learner_level || 'beginner').trim(),
    estimated_duration: String(input.estimated_duration || '').trim(),
    schedule: String(input.schedule || '').trim()
    ,available_time: String(input.available_time || input.schedule || '').trim().slice(0, 80),
    deadline: input.deadline || null,
    status: 'active'
  }
  const supabase = client(auth)
  const { data: plan, error: planError } = await supabase.from('study_plans').insert(planPayload).select('*').single()
  if (planError) throw planError
  const topics = normalizeTopics(input.topics || []).map((topic) => ({
    study_plan_id: plan.id,
    week_number: Number(topic.week_number) || 1,
    title: requiredText(topic.title, 'topic title'),
    lesson: String(topic.lesson || '').trim(),
    exercise: String(topic.exercise || '').trim(),
    sort_order: topic.sort_order
  }))
  if (topics.length) {
    const { error: topicsError } = await supabase.from('study_plan_topics').insert(topics)
    if (topicsError) throw topicsError
  }
  return getStudyPlan(auth, plan.id)
}

export async function getStudyPlan(auth: VerifiedAuth, planId: string) {
  const { data, error } = await client(auth).from('study_plans').select('*,study_plan_topics(*)').eq('id', planId).maybeSingle()
  if (error) throw error
  return data
}

export async function completeStudyPlanTopic(auth: VerifiedAuth, topicId: string, completed: boolean) {
  const status = completed ? 'completed' : 'in_progress'
  const { data, error } = await client(auth).from('study_plan_topics').update({ completed, status, completed_at: completed ? new Date().toISOString() : null }).eq('id', topicId).select('*').single()
  if (error) throw error
  const { data: topics, error: topicError } = await client(auth).from('study_plan_topics').select('completed,study_plan_id').eq('study_plan_id', data.study_plan_id)
  if (topicError) throw topicError
  if (topics?.length && topics.every((topic) => topic.completed)) {
    await client(auth).from('study_plans').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', data.study_plan_id).eq('user_id', auth.userId)
  } else {
    await client(auth).from('study_plans').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', data.study_plan_id).eq('user_id', auth.userId)
  }
  return data
}

export async function deleteStudyPlan(auth: VerifiedAuth, planId: string) {
  const { data, error } = await client(auth).from('study_plans').delete().eq('id', planId).eq('user_id', auth.userId).select('id').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('study plan not found')
}

export default { listProjects, createProject, getProject, listStudyPlans, createStudyPlan, getStudyPlan, completeStudyPlanTopic, deleteStudyPlan }