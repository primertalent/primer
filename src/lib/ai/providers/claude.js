import Anthropic from '@anthropic-ai/sdk'

const DEFAULT_MODEL = 'claude-sonnet-4-6'

// In dev, call the SDK directly so local testing works without a Vercel runtime.
// In production, all AI calls go through api/ai.js (server-side key, no exposure).

export class ClaudeProvider {
  constructor() {
    if (import.meta.env.DEV) {
      this._client = new Anthropic({
        apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
        dangerouslyAllowBrowser: true,
      })
      this._model = import.meta.env.VITE_AI_MODEL || DEFAULT_MODEL
    }
  }

  async generateText({ messages, maxTokens = 1024, system }) {
    if (import.meta.env.DEV) {
      const response = await this._client.messages.create({
        model: this._model,
        max_tokens: maxTokens,
        messages,
        ...(system && { system }),
      })
      return response.content[0]?.text ?? ''
    }

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
