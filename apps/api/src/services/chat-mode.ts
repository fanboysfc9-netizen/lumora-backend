export function mapClientMode(m?: string) {
  if (!m) return 'standard'
  const s = String(m).toLowerCase()
  if (s === 'standard' || s === 'coding' || s === 'creative' || s === 'research') return s
  if (s === 'nira') return 'standard'
  if (s === 'elara') return 'research'
  if (s === 'solara') return 'creative'
  if (s === 'tutor') return 'standard'
  if (s === 'chat') return 'standard'
  if (s === 'coach') return 'standard'
  return 'standard'
}
