import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const DEFAULT_MODEL = 'claude-sonnet-4-6'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { messages, system, maxTokens = 1024 } = req.body

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages must be a non-empty array' })
  }

  try {
    const response = await client.messages.create({
      model: process.env.AI_MODEL || DEFAULT_MODEL,
      max_tokens: maxTokens,
      messages,
      ...(system && { system }),
    })
    return res.status(200).json({ text: response.content[0]?.text ?? '' })
  } catch (err) {
    console.error('Anthropic API error:', err)
    return res.status(500).json({ error: 'AI request failed' })
  }
}
