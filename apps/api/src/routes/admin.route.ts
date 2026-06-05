import { Router, Request, Response } from 'express'
import memoryService from '../../../../core/memory/memory.service'

const router = Router()

// GET /api/admin/profile?userId=...
// Requires header `x-admin-secret` matching process.env.ADMIN_SECRET
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const secret = String(req.header('x-admin-secret') || '')
    if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'forbidden' })
    }

    const userId = String(req.query.userId || '')
    if (!userId) return res.status(400).json({ error: 'userId required' })

    const profile = await memoryService.getUserProfile(userId)
    return res.json({ ok: true, profile })
  } catch (err: any) {
    console.error('admin.route error', err)
    return res.status(500).json({ error: err?.message || 'internal error' })
  }
})

export default router
