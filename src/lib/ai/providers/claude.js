// All AI calls go through /api/ai (server-side key, no browser exposure). Non-negotiable.

export class ClaudeProvider {
  async generateText({ messages, maxTokens = 1024, system }) {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, maxTokens, ...(system && { system }) }),
    })

    if (!res.ok) {
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        throw new Error('API server unreachable. Make sure `vercel dev` is running on port 3000.')
      }
      const { error } = await res.json().catch(() => ({}))
      throw new Error(error || `AI request failed (${res.status})`)
    }

    const { text } = await res.json()
    return text
  }
}
