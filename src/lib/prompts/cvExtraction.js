const EXTRACTION_PROMPT = `Extract structured information from the CV/resume and return ONLY a valid JSON object with these exact keys (use null for any field not found):
{
  "first_name": string,
  "last_name": string,
  "email": string | null,
  "phone": string | null,
  "current_title": string | null,
  "current_company": string | null,
  "location": string | null,
  "skills": string[]
}

Return only the JSON — no markdown, no explanation.`

export function buildCvPdfMessages(base64) {
  return [{
    role: 'user',
    content: [
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      },
      { type: 'text', text: EXTRACTION_PROMPT },
    ],
  }]
}

export function buildCvTextMessages(text) {
  return [{
    role: 'user',
    content: `${EXTRACTION_PROMPT}\n\nCV TEXT:\n${text}`,
  }]
}
