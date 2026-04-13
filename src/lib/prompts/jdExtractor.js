const EXTRACTION_PROMPT = `You are a recruiting assistant. Extract structured role information from the text below and return ONLY a valid JSON object with these exact keys (use null for any field not found):
{
  "title": string | null,
  "comp_min": number | null,
  "comp_max": number | null,
  "comp_type": "salary" | "hourly" | "contract" | "equity_plus_salary" | null,
  "notes": string | null
}

Rules:
- comp_min and comp_max are numbers only (no symbols, no commas). Convert ranges like "$120k-$150k" to 120000 and 150000.
- comp_type must be exactly one of the four values listed or null.
- notes should be the full cleaned job description text — remove excessive whitespace and formatting artifacts but preserve all meaningful content.
- Return only the JSON — no markdown, no explanation.`

export function buildJdMessages(text) {
  return [{
    role: 'user',
    content: `${EXTRACTION_PROMPT}\n\nTEXT:\n${text}`,
  }]
}

export function buildJdPdfMessages(base64) {
  return [{
    role: 'user',
    content: [
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      },
      {
        type: 'text',
        text: 'Return the complete verbatim text of this document. No commentary, no formatting — just the raw text exactly as it appears.',
      },
    ],
  }]
}
