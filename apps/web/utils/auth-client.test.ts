import { authenticatedFetch, ApiAuthenticationError } from './api-client'
import { userScopedStorageKey } from './user-scoped-state'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

export async function run() {
  console.log('[TEST] web auth client')

  let missingRejected = false
  try { await authenticatedFetch('/api/chat', null) } catch (error) { missingRejected = error instanceof ApiAuthenticationError }
  assert(missingRejected, 'Signed-out requests must not call the protected API')

  const originalFetch = globalThis.fetch
  let receivedAuthorization: string | null = null
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    receivedAuthorization = new Headers(init?.headers).get('Authorization')
    return new Response('{}', { status: 200 })
  }) as typeof fetch
  await authenticatedFetch('/api/chat', { access_token: 'test-token' } as any, { method: 'POST' })
  assert(receivedAuthorization === 'Bearer test-token', 'Authenticated requests must include a bearer token')

  globalThis.fetch = (async () => new Response('{}', { status: 401 })) as typeof fetch
  let expiredRejected = false
  try { await authenticatedFetch('/api/chat', { access_token: 'test-token' } as any) } catch (error) { expiredRejected = error instanceof ApiAuthenticationError }
  assert(expiredRejected, 'API 401 responses must be surfaced as session expiration')
  globalThis.fetch = originalFetch

  assert(userScopedStorageKey('lumora_stats', 'user-a') === 'lumora_stats:user-a', 'User state must be scoped to the authenticated user')
  assert(userScopedStorageKey('lumora_stats', 'user-b') !== userScopedStorageKey('lumora_stats', 'user-a'), 'Different users must not share state keys')
  assert(userScopedStorageKey('lumora_stats', null) === null, 'Signed-out state must not have a user key')

  console.log('[PASS] web auth client')
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch((error) => { console.error('[FAIL] web auth client', error); process.exit(1) })
}