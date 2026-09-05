export function parseAllowedOrigins(raw?: string): string[] {
  if (!raw) return []

  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.replace(/\/$/, ''))
}

export function getAllowedOrigins(): string[] {
  const firebaseProject = process.env.FIREBASE_PROJECT || 'YOUR_PROJECT'
  const configuredOrigins = [
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
    ...parseAllowedOrigins(process.env.ALLOWED_ORIGINS)
  ]

  const defaults = [
    'https://lumoracognita.vercel.app',
    `https://${firebaseProject}.web.app`,
    `https://${firebaseProject}.firebaseapp.com`,
    'http://localhost:3000',
    'http://localhost:4000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:4000'
  ]

  return Array.from(new Set([...configuredOrigins, ...defaults].map((origin) => origin.trim().replace(/\/$/, '')).filter(Boolean)))
}

export function isOriginAllowed(origin: string | undefined, allowedOrigins: string[] = getAllowedOrigins()): boolean {
  if (!origin) return false

  const normalizedOrigin = origin.trim().replace(/\/$/, '')
  return allowedOrigins.some((allowed) => allowed.trim().replace(/\/$/, '') === normalizedOrigin)
}
