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
    const prompt = lumoraCore.buildPrompt(coreInput)
    return res.json({ ok: true, prompt: prompt.prompt, metadata: prompt.metadata })
  } catch (err: any) {
    console.error('lumora-core.route error', err)
    return res.status(500).json({ error: err?.message || 'internal error' })
  }
})

export default router
