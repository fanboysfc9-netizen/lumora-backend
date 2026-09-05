import { Router, Request, Response } from 'express'
import cognitaService from '../services/cognita.service'
import authenticateSupabaseRequest, { createOptionalSupabaseAuthMiddleware } from '../middleware/supabase-auth.middleware'
import supabaseChatService from '../services/supabase-chat.service'
import { mapClientMode } from '../services/chat-mode'

const router = Router()

router.post('/', createOptionalSupabaseAuthMiddleware(), async (req: Request, res: Response) => {
  try {
    const { message, conversationId } = req.body
    const userId = req.auth?.userId
    if (!message) return res.status(400).json({ error: 'message is required' })
    const bodyMode = req.body?.mode as string | undefined
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

router.get('/conversations', authenticateSupabaseRequest, async (req: Request, res: Response) => {
  try {
    return res.json({ ok: true, conversations: await supabaseChatService.listConversations(req.auth!, String(req.query.search || '')) })
  } catch (err: any) {
    console.error('conversation list error', err)
    return res.status(500).json({ error: 'conversations unavailable' })
  }
})

router.patch('/conversations/:conversationId', authenticateSupabaseRequest, async (req: Request, res: Response) => {
  try {
    const conversation = await supabaseChatService.renameConversation(req.auth!, req.params.conversationId, String(req.body?.title || ''))
    return res.json({ ok: true, conversation })
  } catch (err: any) {
    const status = err?.message === 'conversation not found' ? 404 : 400
    return res.status(status).json({ error: err?.message || 'conversation update failed' })
  }
})

router.delete('/conversations/:conversationId', authenticateSupabaseRequest, async (req: Request, res: Response) => {
  try {
    await supabaseChatService.deleteConversation(req.auth!, req.params.conversationId)
    return res.status(204).send()
  } catch (err: any) {
    return res.status(err?.message === 'conversation not found' ? 404 : 500).json({ error: err?.message || 'conversation deletion failed' })
  }
})

export default router
