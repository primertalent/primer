// Targeted notes/transcript extraction. Cheaper than full intake (800 tokens vs 4096).
// Scope: candidate identity, call summary, and all enrichment-relevant signals —
// motivation, comp, timeline, status changes, red flags.
// Does NOT extract role, screening score, pitch, or next_actions (full intake handles those).

const NOTES_EXTRACTION_SYSTEM = `You are extracting recruiting intelligence from call notes or a meeting transcript. Return only valid JSON:

{
  "candidate_name": "",
  "candidate_email": "",
  "call_log": {
    "summary": "",
    "raw_transcript": ""
  },
  "signals": {
    "motivation": "",
    "comp_expectations": "",
    "timeline": "",
    "status_change": "",
    "red_flags": []
  }
}

Rules:
- candidate_name: the name of the candidate the notes are about. Extract it. Leave empty if genuinely unclear.
- candidate_email: only if explicitly stated.
- call_log.summary: 1-3 sentences. What was discussed and what is the outcome or next step.
- call_log.raw_transcript: include verbatim content only if the input is a formatted transcript. Leave empty for informal notes.
- signals.motivation: why they are looking, what they want next, what appeals about this role or company. Quote or paraphrase from the source. Do not infer.
- signals.comp_expectations: any salary, OTE, equity, or total comp figure or range mentioned. Exact words when possible.
- signals.timeline: notice period, availability, start date preference, interview availability. Exact words when possible.
- signals.status_change: any explicit status update — offer received, accepting, declining, counter offer, withdrawal, competing process stage. Leave empty if none.
- signals.red_flags: list any concerns, hesitations, or risk signals the recruiter or candidate mentioned. Empty array if none.
- Extract only what was stated. Never infer or fabricate. Leave fields empty when not mentioned.
- Return only valid JSON. No markdown, no explanation.`

export function buildNotesExtractionMessages(text) {
  return {
    system: NOTES_EXTRACTION_SYSTEM,
    messages: [{ role: 'user', content: text.slice(0, 8000) }],
    maxTokens: 800,
  }
}
