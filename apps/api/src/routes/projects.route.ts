import { Router, Request, Response } from 'express'
import authenticateSupabaseRequest from '../middleware/supabase-auth.middleware'
import projectService from '../services/project.service'

const router = Router()
router.use(authenticateSupabaseRequest)

function auth(req: Request) {
  if (!req.auth) throw new Error('authentication required')
  return req.auth
}

router.get('/', async (req, res) => {
  try { return res.json({ ok: true, projects: await projectService.listProjects(auth(req)) }) }
  catch (error) { console.error('[projects] list failed', error); return res.status(500).json({ error: 'projects unavailable' }) }
})

router.post('/', async (req, res) => {
  try { return res.status(201).json({ ok: true, project: await projectService.createProject(auth(req), req.body || {}) }) }
  catch (error: any) { return res.status(400).json({ error: error?.message || 'project could not be created' }) }
})

router.get('/:id', async (req, res) => {
  try {
    const project = await projectService.getProject(auth(req), req.params.id)
    return project ? res.json({ ok: true, project }) : res.status(404).json({ error: 'project not found' })
  } catch (error) { console.error('[projects] get failed', error); return res.status(500).json({ error: 'project unavailable' }) }
})

export default router