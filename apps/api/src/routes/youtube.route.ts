import { Router, Request, Response } from 'express'
import { createOptionalSupabaseAuthMiddleware } from '../middleware/supabase-auth.middleware'
import { resolveLearningContext } from '../services/learning-context.service'
import { normalizeYouTubeQuery, searchYouTube } from '../services/youtube.service'

const router = Router()

router.post('/search', createOptionalSupabaseAuthMiddleware(), async (req: Request, res: Response) => {
  try {
    let query = normalizeYouTubeQuery(req.body?.query)
    const userId = req.auth?.userId
    if (userId && (req.body?.projectContext?.projectId || req.body?.projectContext?.studyPlanId)) {
      const context = await resolveLearningContext({ userId, accessToken: req.auth!.accessToken }, req.body.projectContext)
      const subject = context?.project?.subject || context?.studyPlan?.subject || ''
      const topic = context?.studyPlan?.currentTopic || context?.project?.goal || ''
      query = normalizeYouTubeQuery([query, subject, topic].filter(Boolean).join(' '))
    }
    const result = await searchYouTube(query)
    return res.json({ ok: true, ...result })
  } catch {
    return res.status(200).json({ ok: true, enabled: false, videos: [], error: 'unavailable' })
  }
})

export default router