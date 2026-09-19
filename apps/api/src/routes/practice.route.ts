import { Router, Request } from 'express'
import authenticateSupabaseRequest from '../middleware/supabase-auth.middleware'
import practiceService, { PracticeKind } from '../services/practice.service'

const router = Router()
router.use(authenticateSupabaseRequest)

router.post('/generate', async (req: Request, res) => {
  try {
    if (!req.auth) return res.status(401).json({ error: 'authentication required' })
    const planId = String(req.body?.studyPlanId || '').trim()
    const kind = String(req.body?.kind || 'quiz') as PracticeKind
    if (!planId) return res.status(400).json({ error: 'study plan required' })
    if (!['test', 'quiz', 'exam'].includes(kind)) return res.status(400).json({ error: 'practice type is invalid' })
    return res.json({ ok: true, packet: await practiceService.generatePractice(req.auth, planId, kind) })
  } catch (error: any) {
    const message = error?.message || 'practice could not be prepared'
    return res.status(message === 'study plan not found' ? 404 : 400).json({ error: message })
  }
})

export default router