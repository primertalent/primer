/*
 * api/_lib/matchRoleFromNotes.js — Role matching from Gemini Notes context
 *
 * Two-pass hybrid matcher:
 *   Pass 1 — DB pre-filter: checks current_company against clients.name (ILIKE).
 *     Exactly 1 open role at that client → confidence 95 (98 if role title also in notes).
 *     No API call needed. 0 or 2+ matches fall through to Haiku.
 *   Pass 2 — Haiku: used when Pass 1 is ambiguous. Receives full role list +
 *     candidate fields + notes excerpt. Returns role_id, confidence, match_signals.
 *
 * Confidence scale:
 *   98  — db_exact_plus_title   (company match + role title in notes)
 *   95  — db_exact_single_role  (company match, 1 role at that client)
 *   90+ — haiku (high)          (model confident enough to act autonomously)
 *   60-89 — haiku (probable)    (propose to recruiter with one-click confirm)
 *   <60 — no reliable match     (fall through to current "Add to a role" behavior)
 *
 * Returns { role, confidence, matchType, matchSignals? } | null
 *   matchType: 'db_exact_single_role' | 'db_exact_plus_title' | 'haiku'
 *   role includes process_steps (needed for pipeline insert first stage)
 *
 * Failure is non-blocking — any error returns null and Outcome B continues.
 */

// Normalizes a company name for comparison:
//   1. Lowercase
//   2. Strip comma-prefixed qualifiers ("Anthropic, Inc." → "anthropic")
//   3. Strip leading "The " ("The Anthropic Group" → "anthropic group")
//   4. Strip known legal entity suffixes (space-prefixed at string end)
//   5. Strip residual punctuation, collapse whitespace
//
// Suffix list: Inc / Inc. / LLC / L.L.C. / Corp / Corp. / Corporation /
//   Ltd / Ltd. / Limited / Co / Co. / Company / GmbH / AG / S.A. / Pty / Pty. / Pte / Pte.
function normalizeCompanyName(name) {
  const LEGAL_SUFFIX = /\s+(inc\.?|llc|l\.l\.c\.?|corp\.?|corporation|ltd\.?|limited|co\.?|company|gmbh|ag|s\.a\.?|pty\.?|pte\.?)$/
  return (name || '')
    .toLowerCase()
    .replace(/,\s*.+$/, '')          // strip everything after first comma
    .replace(/^the\s+/, '')          // strip leading "The "
    .replace(LEGAL_SUFFIX, '')       // strip legal entity suffix
    .replace(/[^\w\s]/g, ' ')        // replace residual punctuation with space
    .trim()
    .replace(/\s+/g, ' ')
}

export async function matchRoleFromNotes({ supabase, anthropic, recruiterId, notesBody, candidateFields }) {
  const { current_company, current_title } = candidateFields || {}

  // Fetch all open roles with client data. process_steps included for pipeline auto-create.
  const { data: openRoles, error } = await supabase
    .from('roles')
    .select('id, title, notes, process_steps, clients(id, name)')
    .eq('recruiter_id', recruiterId)
    .eq('status', 'open')

  if (error || !openRoles?.length) return null

  // ── Pass 1: DB pre-filter by current_company ──────────────────────────────
  // Deterministic — no API call.
  // Step 1: exact equality after normalization (both names stripped of legal suffixes,
  //         leading "The ", comma qualifiers).
  // Step 2: substring fallback only when normalized candidate string is ≥6 chars —
  //         kills "AI" / "OpenAI" class of false positives.
  // Haiku handles anything that doesn't match either path.
  if (current_company && current_company.trim().length >= 3) {
    const normCompany = normalizeCompanyName(current_company)

    const clientMatches = openRoles.filter(role => {
      const normClient = normalizeCompanyName(role.clients?.name)
      if (!normClient) return false
      if (normClient === normCompany) return true
      return normCompany.length >= 6 && (
        normClient.includes(normCompany) || normCompany.includes(normClient)
      )
    })

    if (clientMatches.length === 1) {
      const role = clientMatches[0]
      // Bump to 98 if role title also appears in the notes body (stronger confirmation).
      const titleInNotes = !!(notesBody && role.title &&
        notesBody.toLowerCase().includes(role.title.toLowerCase()))
      const confidence = titleInNotes ? 98 : 95
      const matchType  = titleInNotes ? 'db_exact_plus_title' : 'db_exact_single_role'
      return { role, confidence, matchType }
    }
    // 0 or 2+ matches → fall through to Haiku for disambiguation
  }

  // ── Pass 2: Haiku match ───────────────────────────────────────────────────
  // Fires when DB pre-filter is ambiguous or current_company is unavailable.
  const rolesForPrompt = openRoles.map(r => ({
    id:         r.id,
    title:      r.title,
    client:     r.clients?.name || 'Unknown client',
    jd_excerpt: (r.notes || '').slice(0, 150),
  }))

  const candidateSummary = [
    current_title   ? `Title: ${current_title}`    : null,
    current_company ? `Company: ${current_company}` : null,
  ].filter(Boolean).join('\n')

  const notesExcerpt = (notesBody || '').slice(0, 1500)

  // Nothing to reason over → skip API call
  if (!notesExcerpt && !candidateSummary) return null

  try {
    const resp = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages:   [{
        role:    'user',
        content: `Match a recruiter call to the most likely open role. Return ONLY valid JSON.

Candidate:
${candidateSummary || '(no extracted fields)'}

Call notes excerpt:
${notesExcerpt || '(no notes)'}

Active roles:
${JSON.stringify(rolesForPrompt, null, 2)}

Return JSON: {"role_id": "<uuid or null>", "confidence": <0-100>, "match_signals": ["signal1"]}
confidence 90-100: clear match, act autonomously. 60-89: probable, ask recruiter to confirm. Below 60: no reliable match, return null for role_id.`,
      }],
    })

    const raw     = resp.content.find(b => b.type === 'text')?.text?.trim() ?? ''
    const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()
    const parsed  = JSON.parse(cleaned)

    if (!parsed.role_id || typeof parsed.confidence !== 'number' || parsed.confidence < 60) return null

    const matchedRole = openRoles.find(r => r.id === parsed.role_id)
    if (!matchedRole) return null

    return {
      role:         matchedRole,
      confidence:   parsed.confidence,
      matchType:    'haiku',
      matchSignals: parsed.match_signals ?? [],
    }
  } catch {
    return null
  }
}
