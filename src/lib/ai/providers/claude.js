// All AI calls go through /api/ai (server-side key, no browser exposure). Non-negotiable.

export class ClaudeProvider {
  async generateText({ messages, maxTokens = 1024, system }) {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, maxTokens, ...(system && { system }) }),
    })

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}))
      throw new Error(error || `AI request failed (${res.status})`)
    }

    const { text } = await res.json()
    return text
  }
}
