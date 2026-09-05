import { Router, Request } from 'express'
import authenticateSupabaseRequest from '../middleware/supabase-auth.middleware'
import projectService from '../services/project.service'

const router = Router()
router.use(authenticateSupabaseRequest)

function auth(req: Request) {
  if (!req.auth) throw new Error('authentication required')
  return req.auth
}

router.get('/', async (req, res) => {
  try { return res.json({ ok: true, studyPlans: await projectService.listStudyPlans(auth(req)) }) }
  catch (error) { console.error('[study-plans] list failed', error); return res.status(500).json({ error: 'study plans unavailable' }) }
})

router.post('/', async (req, res) => {
  try { return res.status(201).json({ ok: true, studyPlan: await projectService.createStudyPlan(auth(req), req.body || {}) }) }
  catch (error: any) { return res.status(400).json({ error: error?.message || 'study plan could not be created' }) }
})

router.patch('/topics/:topicId', async (req, res) => {
  try {
    return res.json({ ok: true, topic: await projectService.completeStudyPlanTopic(auth(req), req.params.topicId, Boolean(req.body?.completed)) })
  } catch (error) { console.error('[study-plans] topic update failed', error); return res.status(404).json({ error: 'topic not found' }) }
})

router.get('/:id', async (req, res) => {
  try {
    const studyPlan = await projectService.getStudyPlan(auth(req), req.params.id)
    return studyPlan ? res.json({ ok: true, studyPlan }) : res.status(404).json({ error: 'study plan not found' })
  } catch (error) { console.error('[study-plans] get failed', error); return res.status(500).json({ error: 'study plan unavailable' }) }
})

export default router