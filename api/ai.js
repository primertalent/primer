import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const DEFAULT_MODEL = 'claude-sonnet-4-6'

// ── Intake system prompt ──────────────────────────────────

const INTAKE_SYSTEM_PROMPT = `You are Wren, an AI recruiting OS. You receive raw, dirty input from a recruiter.
Your job is to extract everything useful and return structured JSON.

Detect what's in the input and return this exact structure:

{
  "detected": ["resume", "jd", "transcript", "question", "notes"],
  "candidate": {
    "name": "",
    "email": "",
    "current_title": "",
    "current_company": "",
    "cv_text": "",
    "career_summary": "",
    "signals": {
      "motivation": "",
      "relocation": "",
      "comp_expectations": "",
      "timeline": "",
      "red_flags": []
    }
  },
  "role": {
    "title": "",
    "company": "",
    "location": "",
    "salary_range": ""
  },
  "screening": {
    "score": 0,
    "score_label": "",
    "reasoning": "",
    "strengths": [],
    "concerns": [],
    "red_flags": [],
    "questions": []
  },
  "pitch": {
    "one_liner": "",
    "bullets": []
  },
  "call_log": {
    "summary": "",
    "raw_transcript": ""
  },
  "next_actions": [],
  "freeform_answer": ""
}

Rules:
- Never refuse because data is incomplete. Extract what exists, leave the rest null.
- If you detect a question, answer it in freeform_answer using context from the input.
- Score is 1-10. score_label is one of: Strong Pass, Pass, Borderline, Weak, No Match.
- one_liner is under 140 characters.
- Return only valid JSON. No explanation, no markdown.

Writing rules for all text fields (one_liner, bullets, next_actions, freeform_answer, reasoning):
- No em dashes (—), en dashes (–), or dashes as punctuation breaks. Use periods or commas.
- No: "Additionally", "Furthermore", "leveraged", "spearheaded", "proven track record", "passionate"
- Write like a recruiter talking to a colleague. Direct, specific, human. Not AI-sounding.`

// ── Handler ───────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { action, messages, maxTokens = 1024, input } = req.body

  // ── Classify action ──────────────────────────────────
  if (action === 'classify') {
    if (!input || typeof input !== 'string') {
      return res.status(400).json({ error: 'input is required for classify action' })
    }
    const CLASSIFY_PROMPT = `You are classifying a recruiting document. Return only valid JSON with no explanation or markdown: {"type": "resume" | "jd" | "transcript" | "notes", "label": "<short label e.g. 'Suhail Goyal resume', 'Workhelix JD', 'Workhelix call 4/14'>"}`
    try {
      const response = await client.messages.create({
        model: process.env.AI_MODEL || DEFAULT_MODEL,
        max_tokens: 100,
        system: CLASSIFY_PROMPT,
        messages: [{ role: 'user', content: input.slice(0, 2000) }],
      })
      const text = response.content[0]?.text ?? ''
      let parsed
      try { parsed = JSON.parse(text) } catch {
        const match = text.match(/\{[\s\S]*\}/)
        parsed = match ? JSON.parse(match[0]) : { type: 'notes', label: 'Document' }
      }
      return res.status(200).json(parsed)
    } catch (err) {
      console.error('Classify AI error:', err)
      return res.status(500).json({ error: 'Classify failed' })
    }
  }

  // ── Intake action ─────────────────────────────────────
  if (action === 'intake') {
    if (!input || typeof input !== 'string') {
      return res.status(400).json({ error: 'input is required for intake action' })
    }
    try {
      const response = await client.messages.create({
        model: process.env.AI_MODEL || DEFAULT_MODEL,
        max_tokens: 4096,
        system: INTAKE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: input }],
      })

      const text = response.content[0]?.text ?? ''

      // Parse JSON — handle any accidental markdown wrapping
      let parsed
      try {
        parsed = JSON.parse(text)
      } catch {
        const match = text.match(/\{[\s\S]*\}/)
        if (!match) throw new Error('No valid JSON in response')
        parsed = JSON.parse(match[0])
      }

      return res.status(200).json(parsed)
    } catch (err) {
      console.error('Intake AI error:', err)
      return res.status(500).json({ error: 'Intake processing failed' })
    }
  }

  // ── Existing pass-through ─────────────────────────────
  const { system } = req.body
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
