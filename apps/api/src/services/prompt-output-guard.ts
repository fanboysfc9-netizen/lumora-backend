export function isInternalPromptLeak(text: string): boolean {
  const normalized = String(text || '').trim().toLowerCase()
  if (!normalized) return false

  const internalMarkers = [
    'system prompt',
    'developer message',
    'internal system logic',
    'raw system data',
    'teaching rules:',
    'format:',
    'adaptive rule:',
    'safety rule:',
    'external knowledge rule:',
    'you are the core reasoning engine',
    'never mention cortex',
    'serpapi',
    'routing'
  ]

  return (
    /^you are\b/.test(normalized) && /(tutor|assistant|student|system prompt|instruction)/.test(normalized)
  ) || (
    /^answer user questions as\b/.test(normalized) && /(tutor|student|instruction)/.test(normalized)
  ) || internalMarkers.some((marker) => normalized.includes(marker))
}
