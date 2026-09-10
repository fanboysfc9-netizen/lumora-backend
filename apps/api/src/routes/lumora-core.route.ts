import { Router, Request, Response } from 'express'
import * as lumoraCore from '../models/lumora-core'
import { LumoraCoreInput } from '../models/lumora-core/types'

const router = Router()

// POST /api/lumora-core
// Body: { message: string } or { question: string }
router.post('/', async (req: Request, res: Response) => {
  try {
    const message = req.body?.message || req.body?.question
    if (!message) return res.status(400).json({ error: 'message or question is required' })

    const coreInput: LumoraCoreInput = { question: message, userLevel: 'average', strictness: 'moderate' }
    lumoraCore.buildPrompt(coreInput)
    return res.json({ ok: true, available: true })
  } catch (err: any) {
    console.error('lumora-core.route error', { name: err?.name || 'Error' })
    return res.status(500).json({ error: 'Unable to prepare the learning response.' })
  }
})

export default router
