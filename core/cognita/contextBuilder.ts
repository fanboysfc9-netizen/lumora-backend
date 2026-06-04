type Role = 'system' | 'user' | 'assistant'
export type ChatMessage = { role: Role; content: string }

export async function buildContext(opts: {
  userId: string
  history?: Array<{ role: 'user' | 'assistant'; text: string }>
  mode: 'tutor' | 'chat' | 'coach'
  userMessage: string
  systemPrompt: string
}) {
  const { history = [], mode, userMessage, systemPrompt } = opts

  const messages: ChatMessage[] = []

  messages.push({ role: 'system', content: `${systemPrompt}\nMode: ${mode}.` })

  if (history && history.length > 0) {
    // include recent messages (up to last 20)
    const recent = history.slice(-20)
    for (const m of recent) {
      messages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })
    }
  }

  messages.push({ role: 'user', content: userMessage })

  return messages
}

export default buildContext
