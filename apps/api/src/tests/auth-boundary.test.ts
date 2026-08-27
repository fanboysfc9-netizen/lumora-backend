import { createSupabaseAuthMiddleware } from '../middleware/supabase-auth.middleware'
import memoryService from '../../../../core/memory/memory.service'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

function equal(actual: unknown, expected: unknown, message: string) {
  assert(actual === expected, `${message}: expected ${String(expected)}, received ${String(actual)}`)
}

function request(authorization?: string): any {
  return {
    headers: authorization ? { authorization } : {},
    header(name: string) {
      return this.headers[name.toLowerCase()]
    },
    body: { userId: 'user-b' }
  }
}

function response() {
  return {
    statusCode: 200,
    body: undefined as any,
    status(code: number) { this.statusCode = code; return this },
    json(body: any) { this.body = body; return this }
  }
}

async function authenticate(req: any, client: any) {
  const res = response()
  let continued = false
  await createSupabaseAuthMiddleware(client)(req, res as any, () => { continued = true })
  return { res, continued }
}

export async function run() {
  console.log('[TEST] auth boundary')

  const missing = await authenticate(request(), { auth: { getUser: async () => ({ data: {}, error: null }) } })
  equal(missing.res.statusCode, 401, 'Missing authentication must be rejected')
  equal(missing.continued, false, 'Missing authentication must not continue')

  const invalid = await authenticate(request('Bearer expired-token'), { auth: { getUser: async () => ({ data: { user: null }, error: new Error('expired') }) } })
  equal(invalid.res.statusCode, 401, 'Invalid authentication must be rejected')
  equal(invalid.continued, false, 'Invalid authentication must not continue')

  const validRequest = request('Bearer valid-token')
  const valid = await authenticate(validRequest, { auth: { getUser: async () => ({ data: { user: { id: 'user-a' } }, error: null }) } })
  equal(valid.res.statusCode, 200, 'Valid authentication must be accepted')
  equal(valid.continued, true, 'Valid authentication must continue to the route')
  equal(validRequest.auth.userId, 'user-a', 'Identity must come from the verified token')
  assert(validRequest.auth.userId !== validRequest.body.userId, 'Client userId must not override verified identity')

  ;(memoryService as any).db = null
  const userAConversation = await memoryService.createConversation('user-a')
  equal(await memoryService.conversationBelongsToUser(userAConversation, 'user-a'), true, 'Owner must access their conversation')
  equal(await memoryService.conversationBelongsToUser(userAConversation, 'user-b'), false, 'Other users must not own the conversation')
  equal(await memoryService.conversationBelongsToUser('missing-conversation', 'user-a'), false, 'Unknown conversations must fail closed')

  console.log('[PASS] auth boundary')
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch((error) => { console.error('[FAIL] auth boundary', error); process.exit(1) })
}