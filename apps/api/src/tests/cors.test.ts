import assert from 'assert'
import { getAllowedOrigins, isOriginAllowed, parseAllowedOrigins } from '../cors'

const originalFrontendUrl = process.env.FRONTEND_URL
const originalAllowedOrigins = process.env.ALLOWED_ORIGINS
const originalFirebaseProject = process.env.FIREBASE_PROJECT

function restoreEnv() {
  if (originalFrontendUrl === undefined) delete process.env.FRONTEND_URL
  else process.env.FRONTEND_URL = originalFrontendUrl

  if (originalAllowedOrigins === undefined) delete process.env.ALLOWED_ORIGINS
  else process.env.ALLOWED_ORIGINS = originalAllowedOrigins

  if (originalFirebaseProject === undefined) delete process.env.FIREBASE_PROJECT
  else process.env.FIREBASE_PROJECT = originalFirebaseProject
}

function assertAllowedProductionOrigin() {
  process.env.FRONTEND_URL = 'https://lumora-web.vercel.app'
  delete process.env.ALLOWED_ORIGINS
  delete process.env.FIREBASE_PROJECT

  const allowed = getAllowedOrigins()
  assert.ok(isOriginAllowed('https://lumora-web.vercel.app', allowed), 'Configured production origin should be allowed')
}

function assertRejectsUntrustedOrigin() {
  delete process.env.FRONTEND_URL
  delete process.env.ALLOWED_ORIGINS
  delete process.env.FIREBASE_PROJECT

  const allowed = getAllowedOrigins()
  assert.strictEqual(isOriginAllowed('https://evil.example', allowed), false, 'Untrusted origin should be rejected')
}

function assertPreservesExistingOrigins() {
  process.env.FIREBASE_PROJECT = 'demoapp'
  delete process.env.FRONTEND_URL
  delete process.env.ALLOWED_ORIGINS

  const allowed = getAllowedOrigins()
  assert.ok(isOriginAllowed('http://localhost:3000', allowed), 'Development localhost origin must remain allowed')
  assert.ok(isOriginAllowed('http://127.0.0.1:4000', allowed), '127.0.0.1 localhost origin must remain allowed')
  assert.ok(isOriginAllowed('https://demoapp.web.app', allowed), 'Firebase web origin must remain allowed')
  assert.ok(isOriginAllowed('https://demoapp.firebaseapp.com', allowed), 'Firebase app origin must remain allowed')
}

function assertParsesConfiguredOrigins() {
  process.env.ALLOWED_ORIGINS = 'https://one.example.com, https://two.example.com ,https://three.example.com/'
  assert.deepStrictEqual(parseAllowedOrigins(process.env.ALLOWED_ORIGINS), [
    'https://one.example.com',
    'https://two.example.com',
    'https://three.example.com'
  ])
}

try {
  assertAllowedProductionOrigin()
  assertRejectsUntrustedOrigin()
  assertPreservesExistingOrigins()
  assertParsesConfiguredOrigins()
  console.log('CORS assertions passed')
} finally {
  restoreEnv()
}
