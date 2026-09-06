import { authenticatedFetch, ApiAuthenticationError, AuthenticationRequiredError } from './api-client'
import { buildWorkspaceApiUrl, normalizeApiBaseUrl } from './api-endpoints'
import { getTimeGreeting } from './time-greeting'
import { userScopedStorageKey } from './user-scoped-state'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`)
}

export async function run() {
  console.log('[TEST] web auth client')

  let missingRejected = false
  try { await authenticatedFetch('/api/chat', null) } catch (error) { missingRejected = error instanceof AuthenticationRequiredError }
  assert(missingRejected, 'Signed-out requests must fail as authentication required, not as expired session')

  const originalFetch = globalThis.fetch
  let guestAuthorization: string | null = null
  let guestChatSucceeded = false
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    guestAuthorization = new Headers(init?.headers).get('Authorization')
    return new Response(JSON.stringify({ ok: true, text: 'Hello from Cognita' }), { status: 200 })
  }) as typeof fetch
  const guestResponse = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Hello Cognita' })
  })
  guestChatSucceeded = guestResponse.ok
  assert(guestChatSucceeded, 'Anonymous guest chat request must succeed without a Supabase bearer token')
  assert(guestAuthorization === null, 'Guest chat requests must omit the Authorization header')

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

  assertEqual(getTimeGreeting(new Date('2024-01-01T08:00:00')), 'Good morning', 'Morning times should say Good morning')
  assertEqual(getTimeGreeting(new Date('2024-01-01T11:14:00')), 'Good morning', 'Mid-morning times should say Good morning')
  assertEqual(getTimeGreeting(new Date('2024-01-01T12:00:00')), 'Good afternoon', 'Noon should say Good afternoon')
  assertEqual(getTimeGreeting(new Date('2024-01-01T16:00:00')), 'Good afternoon', 'Afternoon times should say Good afternoon')
  assertEqual(getTimeGreeting(new Date('2024-01-01T18:00:00')), 'Good evening', 'Evening times should say Good evening')
  assertEqual(getTimeGreeting(new Date('2024-01-01T23:00:00')), 'Good evening', 'Late evening times should say Good evening')

  assert(userScopedStorageKey('lumora_stats', 'user-a') === 'lumora_stats:user-a', 'User state must be scoped to the authenticated user')
  assert(userScopedStorageKey('lumora_stats', 'user-b') !== userScopedStorageKey('lumora_stats', 'user-a'), 'Different users must not share state keys')
  assert(userScopedStorageKey('lumora_stats', null) === null, 'Signed-out state must not have a user key')

  assertEqual(normalizeApiBaseUrl('https://backend.example.com/api/chat'), 'https://backend.example.com/api', 'Chat endpoint base URL should strip the trailing /chat segment')
  assertEqual(buildWorkspaceApiUrl('https://backend.example.com/api/chat', '/projects'), 'https://backend.example.com/api/projects', 'Projects requests must target the API root not the chat URL')
  assertEqual(buildWorkspaceApiUrl('https://backend.example.com/api/chat', '/study-plans'), 'https://backend.example.com/api/study-plans', 'Study plan requests must target the API root not the chat URL')

  console.log('[PASS] web auth client')
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch((error) => { console.error('[FAIL] web auth client', error); process.exit(1) })
}