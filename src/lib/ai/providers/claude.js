import Anthropic from '@anthropic-ai/sdk'

// ─────────────────────────────────────────────────────────
// SECURITY NOTE: VITE_ANTHROPIC_API_KEY is embedded in the
// client bundle and is visible to anyone who inspects it.
// Before shipping, move this to a Vercel serverless function
// (e.g. api/ai.js) and proxy requests from here.
// ─────────────────────────────────────────────────────────

const DEFAULT_MODEL = 'claude-sonnet-4-6'

export class ClaudeProvider {
  constructor() {
    this._client = new Anthropic({
      apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
      dangerouslyAllowBrowser: true,
    })
    this._model = import.meta.env.VITE_AI_MODEL || DEFAULT_MODEL
  }

  async generateText({ messages, maxTokens = 1024 }) {
    const response = await this._client.messages.create({
      model: this._model,
      max_tokens: maxTokens,
      messages,
    })
    return response.content[0]?.text ?? ''
  }
}
