import { Router, Request, Response } from 'express'
import cognitaService from '../services/cognita.service'
import authenticateSupabaseRequest, { createOptionalSupabaseAuthMiddleware } from '../middleware/supabase-auth.middleware'
import supabaseChatService from '../services/supabase-chat.service'

const router = Router()

router.post('/', createOptionalSupabaseAuthMiddleware(), async (req: Request, res: Response) => {
  try {
    const { message, conversationId } = req.body
    const userId = req.auth?.userId
    if (!message) return res.status(400).json({ error: 'message is required' })
    const bodyMode = req.body?.mode as string | undefined

    // Map frontend mode names to internal Mode values
    const mapClientMode = (m?: string) => {
      if (!m) return 'standard'
      const s = String(m).toLowerCase()
      if (s === 'standard' || s === 'coding' || s === 'creative' || s === 'research') return s
      if (s === 'nira') return 'standard'
      if (s === 'elara') return 'research'
      if (s === 'solara') return 'creative'
      // Legacy mappings
      if (s === 'tutor') return 'standard'
      if (s === 'chat') return 'standard'
      if (s === 'coach') return 'standard'
      return 'standard'
    }

    const mappedMode = mapClientMode(bodyMode)

    const result = await cognitaService.handleMessage({ userId, message, conversationId, mode: mappedMode })
    if (!userId) return res.json({ ok: true, ...result })

    const persistedConversationId = await supabaseChatService.persistExchange(
      { userId, accessToken: req.auth!.accessToken },
      conversationId,
      [
        { role: 'user', content: message, mode: mappedMode },
        { role: 'assistant', content: result.text || '', mode: mappedMode }
      ]
    )
    return res.json({ ok: true, conversationId: persistedConversationId, ...result })
  } catch (err: any) {
    console.error('chat.route error', err)
    return res.status(500).json({ error: err?.message || 'internal error' })
  }
})

router.get('/history', authenticateSupabaseRequest, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId
    const conversationId = req.query.conversationId ? String(req.query.conversationId) : undefined
    if (!userId) return res.status(401).json({ error: 'authentication required' })
    const history = await supabaseChatService.getHistory({ userId, accessToken: req.auth!.accessToken }, conversationId, 200)
    return res.json({ ok: true, ...history })
  } catch (err: any) {
    console.error('history error', err)
    return res.status(500).json({ error: err?.message || 'internal error' })
  }
})

export default router
