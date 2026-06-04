#!/usr/bin/env node
/**
 * verify_env.js
 * Simple build-time check to ensure NEXT_PUBLIC_API_URL is set and not localhost
 * when building for production. Run as a prebuild script.
 */
const fs = require('fs')
const path = require('path')
try {
  // load .env files if present to aid local builds
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env') })
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env.production') })
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') })
} catch (e) {}

const api = process.env.NEXT_PUBLIC_API_URL
if (!api) {
  console.error('\n[verify_env] ERROR: NEXT_PUBLIC_API_URL is not set.\nSet NEXT_PUBLIC_API_URL to your backend endpoint before building.\nExample:\n  NEXT_PUBLIC_API_URL=https://your-backend.example.com/api/chat\n')
  process.exit(1)
}

const isLocal = /(^https?:\/\/(localhost|127\.0\.0\.1))/i.test(api) || /localhost|127\.0\.0\.1/.test(api)
if (process.env.NODE_ENV === 'production' && isLocal) {
  console.error(`\n[verify_env] ERROR: NEXT_PUBLIC_API_URL is set to a localhost address while building for production: ${api}\nThis will bake a localhost URL into your static build and cause fetch failures in production.\nSet NEXT_PUBLIC_API_URL to your production backend URL (not localhost) and rebuild.\n`)
  process.exit(1)
}

console.log('[verify_env] NEXT_PUBLIC_API_URL OK:', api)
process.exit(0)
