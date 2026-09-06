export function isInternalPromptLeak(text: string): boolean {
  const normalized = String(text || '').trim().toLowerCase()
  if (!normalized) return false

  return (
    /^you are\b/.test(normalized) && /(tutor|assistant|student|system prompt|instruction)/.test(normalized)
  ) || (
    /^answer user questions as\b/.test(normalized) && /(tutor|student|instruction)/.test(normalized)
  )
}