/*
 * api/_lib/extractCompFromNotes.js — Extract expected comp from Gemini Notes
 *
 * Two-pass hybrid:
 *   Pass 1 — regex: scans motivationSummary (if available) then notesBody for
 *     explicit numeric comp signals within 80 chars of comp-related keywords.
 *     Confidence 90 — the number is literally in the text near a comp word.
 *   Pass 2 — Haiku: fires when regex finds nothing. Works from notesBody excerpt.
 *     Confidence from model; auto-write threshold ≥ 80.
 *
 * Auto-write threshold: ≥ 80.
 * Returns { low, high, confidence, source_excerpt, pass } | null
 *   pass: 'regex' | 'haiku' | (null when returning null)
 */

// Normalize a raw number string ("175k", "175,000", "175") to a whole-dollar integer.
// Returns null for values outside expected recruiting comp range ($30k–$2M).
function normalizeCompNumber(raw) {
  const hasK = /k$/i.test(raw)
  const n = parseFloat(raw.replace(/[,k]/gi, ''))
  if (isNaN(n) || n <= 0) return null
  const val = hasK        ? Math.round(n * 1000)
            : n >= 10000  ? Math.round(n)           // absolute: 175000
            : n >= 100    ? Math.round(n * 1000)    // shorthand: 175 → 175,000
            : null                                   // < 100: not a comp value
  if (!val || val < 30_000 || val > 2_000_000) return null
  return val
}

// Scan a text string for explicit numeric comp signals near comp-adjacent keywords.
// Checks within an 80-char window of each keyword hit.
// Returns { low, high, source_excerpt } or null.
function regexExtract(text) {
  if (!text) return null

  const COMP_KW = /\b(comp(?:ensation)?|salary|base(?:\s+salary)?|pay(?:ment)?|earn(?:ing)?|mak(?:ing|e)|expect(?:ation|ing)?|looking\s+for|target(?:ing)?|need(?:ing)?|want(?:ing)?|currently\s+at|current(?:ly)?|total\s+comp|offer(?:ing|ed)?|ask(?:ing)?|desired|package)\b/gi

  const kwPositions = []
  let m
  COMP_KW.lastIndex = 0
  while ((m = COMP_KW.exec(text)) !== null) kwPositions.push(m.index)
  if (!kwPositions.length) return null

  const inWindow = pos => kwPositions.some(kp => Math.abs(kp - pos) <= 80)

  // Range: "150k-180k", "$150,000 to $200,000", "150 to 180k"
  const RANGE = /\$?\s*([\d,]+k?)\s*(?:to|-|–)\s*\$?\s*([\d,]+k?)/gi
  RANGE.lastIndex = 0
  while ((m = RANGE.exec(text)) !== null) {
    if (!inWindow(m.index)) continue
    const low  = normalizeCompNumber(m[1])
    const high = normalizeCompNumber(m[2])
    if (low && high && high > low) return { low, high, source_excerpt: m[0].trim() }
  }

  // Single number with k suffix: "$175k", "175k"
  const SINGLE_K = /\$?\s*([\d,]+k)\b/gi
  SINGLE_K.lastIndex = 0
  while ((m = SINGLE_K.exec(text)) !== null) {
    if (!inWindow(m.index)) continue
    const low = normalizeCompNumber(m[1])
    if (low) return { low, high: null, source_excerpt: m[0].trim() }
  }

  // Absolute dollar amounts with explicit $ sign: "$175,000", "$175000"
  const ABS = /\$\s*([\d]{2}[\d,]+)\b/gi
  ABS.lastIndex = 0
  while ((m = ABS.exec(text)) !== null) {
    if (!inWindow(m.index)) continue
    const low = normalizeCompNumber(m[1])
    if (low) return { low, high: null, source_excerpt: m[0].trim() }
  }

  return null
}

export async function extractCompFromNotes({ anthropic, notesBody, motivationSummary }) {
  // ── Pass 1: Regex ──────────────────────────────────────────────────────────
  // motivationSummary first (already curated by the intake Haiku call, lower noise).
  // notesBody as fallback (rawer, more verbose, but still useful).
  const sources = [motivationSummary, (notesBody || '').slice(0, 3000)].filter(Boolean)

  for (const src of sources) {
    const hit = regexExtract(src)
    if (hit) {
      return { low: hit.low, high: hit.high, confidence: 90, source_excerpt: hit.source_excerpt, pass: 'regex' }
    }
  }

  // ── Pass 2: Haiku ──────────────────────────────────────────────────────────
  // Fires when regex finds nothing. Works from notesBody alone.
  const notesExcerpt = (notesBody || '').slice(0, 2000)
  if (!notesExcerpt) return null

  try {
    const resp = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 120,
      messages:   [{
        role:    'user',
        content: `Extract the job candidate's stated compensation expectation from these recruiter call notes. Return ONLY valid JSON.

Call notes:
${notesExcerpt}

Return JSON: {"expected_low": <annual integer or null>, "expected_high": <annual integer or null>, "confidence": <0-100>, "source_excerpt": "<exact quoted phrase or null>"}
- expected_low/high: whole dollar amounts (e.g. 175000). null if no explicit comp stated.
- confidence: 80–100 only when a specific number was clearly stated. 0 if nothing found or only vague signals like "market rate".`,
      }],
    })

    const raw    = resp.content.find(b => b.type === 'text')?.text?.trim() ?? ''
    const clean  = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()
    const parsed = JSON.parse(clean)

    if (!parsed.expected_low || typeof parsed.confidence !== 'number' || parsed.confidence < 80) return null

    return {
      low:            Math.round(parsed.expected_low),
      high:           parsed.expected_high ? Math.round(parsed.expected_high) : null,
      confidence:     parsed.confidence,
      source_excerpt: typeof parsed.source_excerpt === 'string' ? parsed.source_excerpt : null,
      pass:           'haiku',
    }
  } catch {
    return null
  }
}
