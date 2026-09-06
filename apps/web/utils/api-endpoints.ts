export function normalizeApiBaseUrl(apiUrl: string | undefined): string {
  if (!apiUrl) return ''
  return apiUrl.replace(/\/chat\/?$/, '')
}

export function buildWorkspaceApiUrl(apiUrl: string | undefined, endpoint: string): string {
  const base = normalizeApiBaseUrl(apiUrl)
  if (!base) return endpoint
  return `${base}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
}