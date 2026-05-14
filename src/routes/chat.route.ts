import { Router } from 'express'
import cognitaService from '../services/cognita.service'

const router = Router()

router.post('/', async (req, res) => {
  try {
    const { userId, message, conversationId } = req.body
    if (!userId || !message) return res.status(400).json({ error: 'userId and message are required' })

    const bodyMode = req.body?.mode as string | undefined

    // Map frontend mode names to internal Mode values
    const mapClientMode = (m?: string) => {
      if (!m) return 'standard'
      const s = String(m).toLowerCase()
      if (s === 'standard' || s === 'coding' || s === 'creative' || s === 'research') return s
      // Legacy mappings
      if (s === 'tutor') return 'standard'
      if (s === 'chat') return 'standard'
      if (s === 'coach') return 'standard'
      return 'standard'
    }

    const mappedMode = mapClientMode(bodyMode)

    const result = await cognitaService.handleMessage({ userId, message, conversationId, mode: mappedMode })
    return res.json({ ok: true, ...result })
  } catch (err: any) {
    console.error('chat.route error', err)
    return res.status(500).json({ error: err?.message || 'internal error' })
  }
})

router.get('/history', async (req, res) => {
  try {
    const userId = String(req.query.userId || '')
    const conversationId = req.query.conversationId ? String(req.query.conversationId) : undefined
    if (!userId) return res.status(400).json({ error: 'userId is required' })
    const history = await (require('../../../core/memory/memory.service').default).getConversationHistory(userId, conversationId, 200)
    return res.json({ ok: true, history })
  } catch (err: any) {
    console.error('history error', err)
    return res.status(500).json({ error: err?.message || 'internal error' })
  }
})

export default router
