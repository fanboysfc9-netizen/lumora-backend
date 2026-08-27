import { Router, Request, Response } from 'express'
import authenticateSupabaseRequest from '../middleware/supabase-auth.middleware'
import accountService from '../services/account.service'
import entitlementService from '../services/entitlement.service'

const router = Router()
router.use(authenticateSupabaseRequest)

function getAuth(req: Request) {
  if (!req.auth) throw new Error('authentication required')
  return req.auth
}

async function handle(res: Response, work: () => Promise<unknown>) {
  try {
    return res.json({ ok: true, ...(await work() as object) })
  } catch (error) {
    console.error('[account] Supabase account query failed:', error instanceof Error ? error.message : error)
    return res.status(500).json({ error: 'account data unavailable' })
  }
}

router.get('/', (req, res) => handle(res, async () => ({ account: await accountService.getCurrentAccount(getAuth(req)) })))
router.get('/subscription', (req, res) => handle(res, async () => ({ subscription: await accountService.getCurrentSubscription(getAuth(req)) })))
router.get('/entitlements', (req, res) => handle(res, async () => ({ entitlements: await entitlementService.getUserEntitlements(getAuth(req)) })))
router.get('/usage', (req, res) => handle(res, async () => ({ usage: await accountService.getCurrentUsage(getAuth(req)) })))

export default router
