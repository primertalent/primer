import { buildVoiceBlock, buildRuleZero } from './voiceRules.js'
import { VOICE_CONTRACT } from './voiceContract.js'

function getToday() {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: 'long', day: 'numeric',
  }).format(new Date())
}

// ─── /wren two-surface submittal ─────────────────────────────────────────────
// Used exclusively by api/wren.js. Desk pages use buildSubmissionMessages below.
//
// mode: 'internal' — recruiter-facing breakdown, flags up, never sent
// mode: 'external' — HM-ready, flags resolved, recruiter's voice
// format: 'bulleted' | 'paragraph' | 'concise' (external only; internal is always structured sections)
// resolvedFlags: string summary of what was resolved in the working session (external only)
// voiceSamples: [{ channel, subject, body }] from voice_samples table
export function buildSubmittalForWren(candidate, role, {
  mode = 'internal',
  format = 'bulleted',
  fitScore = null,
  resolvedFlags = '',
  voiceSamples = [],
} = {}) {
  if (mode === 'internal') {
    return buildInternalBreakdownMessages(candidate, role, fitScore, voiceSamples)
  }
  return buildExternalSubmittalMessages(candidate, role, fitScore, format, resolvedFlags, voiceSamples)
}

function buildInternalBreakdownMessages(candidate, role, fitScore, voiceSamples) {
  const ruleZero = buildRuleZero()
  const voiceBlock = buildVoiceBlock(null, voiceSamples)
  const candidateSection = buildCandidateSection(candidate)
  const roleSection = buildRoleSection(role)
  const fitSection = fitScore != null ? `\nFit score against this role: ${Math.round(fitScore)}/100` : ''

  const prompt = `Today's date: ${getToday()}. Use this for tenure and availability calculations.

You are a technical recruiter producing an internal candidate breakdown before deciding whether to submit.

${ruleZero}

${VOICE_CONTRACT}

${voiceBlock}

This breakdown is for the recruiter only — never sent to the hiring manager. Name every flag plainly. Do not soften. The recruiter needs the truth to decide whether to submit, reframe, or pass.

CANDIDATE
${candidateSection}${fitSection}

ROLE
${roleSection}

Produce exactly this structure, plain text, no markdown:

HOOK
One sentence, ~140 characters. The single most compelling concrete fact about this candidate for this role. Lead with a real number if one exists. If no strong quantified signal is available from the provided data: state the strongest grounded fact and append [NEEDS: <the specific fact that would strengthen this hook — e.g., "quota attainment from call">]

WHY FIT
Fact bullets mapped to real requirements in the role. Pull from resume, career timeline, notes, and any interactions. One signal per bullet. Use – dashes, not markdown. If a key role requirement has no candidate evidence in the available data, add a gap bullet:
– [NEEDS: evidence for <requirement> — not found in available data]

SCREENING ANSWERS
For each make-or-break screen (comp expectations, availability/notice, motivation for leaving, and role-specific technical requirements from the JD):
– <question>: <answer from notes, resume, or interactions, or [NOT CAPTURED — confirm before submitting]>
If no call notes or interactions exist: write "No call data available. Confirm before submitting:" and list the key questions from the role. This is the expected pre-call format — not a failure, not a degraded mode.

RISK
The single most material gap, named plainly. No softening. Examples: "Experience cap: 3 years, role targets 5+." "Tenure flag: two roles under 18 months." "Pedigree miss: all mid-market, client wants enterprise." If no material risk is identifiable from available data: "No material risk identified from available data — confirm on call."
POSSIBLE REFRAMES: How the recruiter could position this if proceeding — one or two lines.

Output nothing else. No intro sentence, no closing commentary.`

  return [{ role: 'user', content: prompt }]
}

function buildExternalSubmittalMessages(candidate, role, fitScore, format, resolvedFlags, voiceSamples) {
  const ruleZero = buildRuleZero()
  const voiceBlock = buildVoiceBlock(null, voiceSamples)
  const candidateSection = buildCandidateSection(candidate)
  const roleSection = buildRoleSection(role)
  const fitSection = fitScore != null ? `\nFit score against this role: ${Math.round(fitScore)}/100` : ''

  const resolvedFlagsSection = resolvedFlags
    ? `\nRESOLVED FLAGS FROM WORKING SESSION:\n${resolvedFlags}\nTreat all resolved flags as decided. Write around them cleanly — no hedging, no risk language, no mention of the original flag.`
    : ''

  const motivationRule = `Candidate motivation is a primary closing signal — place it near the CTA. Use the candidate's actual stated reason for interest, verbatim in substance. "Wants an AE path because his current company has none" is real and usable. "Drawn to [Company]'s mission and culture" constructed from that is fabrication — never bridge the gap with invented alignment. If real motivation is not in the available data, write [NEEDS: candidate's stated reason for interest — confirm before sending]. That placeholder is more useful than a hollow alignment sentence a sharp HM will see through.`

  const formatInstructions = buildExternalFormatInstructions(format)

  const prompt = `Today's date: ${getToday()}. Use this for tenure and availability calculations.

You are an expert technical recruiter writing a candidate submission for a hiring manager.

${ruleZero}

${VOICE_CONTRACT}

${voiceBlock}

This is the external, HM-ready version. No risk section appears in any format. The internal flags have been resolved per the recruiter's direction — write the output clean.${resolvedFlagsSection}

${motivationRule}

CANDIDATE
${candidateSection}${fitSection}

ROLE
${roleSection}

${formatInstructions}

Write only the submission body. No subject line. No greeting unless the format explicitly includes one. No signature. No closing commentary.`

  return [{ role: 'user', content: prompt }]
}

function buildExternalFormatInstructions(format) {
  if (format === 'paragraph') {
    return `Write a narrative paragraph submission. Third person, recruiter voice. Under 250 words.
Structure:
– Opening: who they are and the single sharpest reason they fit this role. One declarative sentence.
– Body: 2-3 strengths mapped to role requirements, with real metrics from the data where available.
– Motivation: candidate's actual stated reason for this org, near the close. Or [NEEDS: stated reason — confirm before sending] if absent.
– CTA: one low-friction question. "Worth 30 minutes?" is the target energy.`
  }

  if (format === 'concise') {
    return `Write the Slack-ready concise format. Under 80 words total. This is not the full submittal compressed — it is the HM-ready pitch stripped to the signal and the ask.
Structure:
Verdict: one declarative sentence. Who they are and the fit verdict.
– [strongest quantified point]
– [second strongest, only if genuinely strong — omit if not]
– [key logistics: availability, location, comp if known]
CTA: one line.
No hook ceremony. No opening pleasantries. No risk. Just signal and ask.`
  }

  if (format === 'linkedin') {
    return `Write a LinkedIn direct message to a hiring manager who may not have full context on this recruiter or candidate. Under 90 words total.
Opener: one sentence establishing context. State you are a recruiter, name the candidate, and name the role. Direct, no preamble. ("Reaching out about [Candidate Name] for your [Role Title] opening" is the energy.)
Signal: 2-3 of the tightest evidence points with real metrics from the data. One sentence each. No fabricated numbers.
Motivation: candidate's actual stated reason for interest, near the close. Or [NEEDS: stated reason — confirm before sending] if absent.
CTA: one low-friction close. "Worth a quick chat?" is the target energy.
Slightly warmer register than Slack — this is a person being messaged, not an internal channel. Recruiter voice. Rule zero applies. No fabrication. No em dashes.`
  }

  // Default: bulleted (Paraform format)
  return `Write the bulleted submission format. Plain text — use – dashes, not markdown. Total under 150 words.
Structure:
[Candidate name] | [Role title at Company]

Background: 1 sentence. Current title, company, years experience only if stated in the data. Facts only.
Key fit:
– [fact bullet 1, mapped to a role requirement, metric if real]
– [fact bullet 2]
– [fact bullet 3 only if genuinely strong — omit if not]
Motivation: [candidate's actual stated reason, one clean sentence] OR [NEEDS: stated reason — confirm before sending]
CTA: [one low-friction close. "Worth 30 minutes?" is the target energy.]`
}

function buildCandidateSection(candidate) {
  const skills = candidate.skills?.join(', ') || 'None listed'

  const timelineSection = candidate.career_timeline?.length
    ? `\nCareer timeline:\n${candidate.career_timeline
        .map(e => `– ${e.title} at ${e.company} (${e.start}-${e.end ?? 'Present'})${
          e.achievements?.length ? '\n  Achievements: ' + e.achievements.join(' | ') : ''
        }`)
        .join('\n')}`
    : ''

  const notesSection = candidate.notes
    ? `\nNotes: ${candidate.notes.slice(0, 1000)}`
    : ''

  const interactionsSection = candidate.recent_interactions?.length
    ? `\nRecent interactions:\n${candidate.recent_interactions
        .map(i => `– ${i.type} (${i.direction ?? 'n/a'}) ${i.occurred_at?.slice(0, 10) ?? ''}: ${(i.body || '').slice(0, 600)}`)
        .join('\n')}`
    : ''

  // career_signals is a JSONB object (keys like motivation, comp_expectations,
  // timeline). May arrive parsed, as a JSON string, null, or undefined — the
  // pasted-resume path never sets it. No-op cleanly in every non-object case.
  const signalsSection = (() => {
    const raw = candidate.career_signals
    const obj = typeof raw === 'string'
      ? (() => { try { return JSON.parse(raw) } catch { return null } })()
      : raw
    if (!obj || typeof obj !== 'object') return ''
    const lines = Object.entries(obj)
      .filter(([, v]) => v != null && (Array.isArray(v) ? v.length : String(v).trim()))
      .map(([k, v]) => `– ${k}: ${(Array.isArray(v) ? v.join(', ') : String(v)).slice(0, 200)}`)
    return lines.length ? `\nCareer signals:\n${lines.join('\n').slice(0, 600)}` : ''
  })()

  // recent_debriefs: up to 3 rows fetched by buildSubmittalDraftPayload. Undefined
  // on the pasted-resume path, empty when the candidate has no debriefs — no-op either
  // way. Motivation/risk are the richest captured signal; render them verbatim.
  const debriefsSection = candidate.recent_debriefs?.length
    ? `\nRecent debriefs (from screening/interview calls):\n${candidate.recent_debriefs
        .map(d => {
          const motivation = Array.isArray(d.motivation_signals) ? d.motivation_signals.join(' | ') : ''
          const risk = Array.isArray(d.risk_flags) ? d.risk_flags.join(' | ') : ''
          return [
            `– ${d.outcome ?? 'neutral'} ${d.captured_at?.slice(0, 10) ?? ''}`.trim(),
            d.summary ? `  Summary: ${d.summary.slice(0, 200)}` : '',
            motivation ? `  Motivation: ${motivation.slice(0, 300)}` : '',
            risk ? `  Risk: ${risk.slice(0, 300)}` : '',
          ].filter(Boolean).join('\n')
        })
        .join('\n')}`
    : ''

  const cvSection = candidate.cv_text
    ? `\nCV text:\n${candidate.cv_text.slice(0, 5000)}`
    : ''

  return `Name: ${candidate.first_name} ${candidate.last_name}
Current: ${candidate.current_title ?? 'Unknown'} at ${candidate.current_company ?? 'Unknown'}
Location: ${candidate.location ?? 'Not specified'}
Skills: ${skills}${notesSection}${timelineSection}${interactionsSection}${signalsSection}${debriefsSection}${cvSection}`
}

function buildRoleSection(role) {
  const comp = formatComp(role.comp_min, role.comp_max, role.comp_type)
  const steps = Array.isArray(role.process_steps)
    ? role.process_steps.join(' → ')
    : (role.process_steps || '')
  const jdSection          = role.notes            ? `\nJD:\n${role.notes.slice(0, 3000)}`               : ''
  const industryLine       = role.clients?.industry ? `\nClient industry: ${role.clients.industry}`       : ''
  const clientNotesLine    = role.clients?.notes    ? `\nClient notes: ${role.clients.notes.slice(0, 500)}` : ''

  return `Title: ${role.title}
Company: ${role.clients?.name ?? 'Unknown'}${industryLine}${clientNotesLine}${comp ? `\nComp range: ${comp}` : ''}${steps ? `\nProcess: ${steps}` : ''}${jdSection}`
}

// ─── Desk callers (unchanged) ─────────────────────────────────────────────────

// format: 'email' | 'bullet'
// voiceSamples: optional [{ channel, subject, body }] from voice_samples table — calibrates tone to the recruiter's style.
export function buildSubmissionMessages(candidate, role, fitScore, format = 'email', voiceSamples = []) {
  const skills = candidate.skills?.join(', ') || 'None listed'
  const comp = formatComp(role.comp_min, role.comp_max, role.comp_type)

  const timelineSection = candidate.career_timeline?.length
    ? `\nCAREER TIMELINE (parsed):\n${candidate.career_timeline
        .map(e => `- ${e.title} at ${e.company} (${e.start}-${e.end ?? 'Present'})${
          e.achievements?.length ? '\n  Achievements: ' + e.achievements.join(' | ') : ''
        }`)
        .join('\n')}`
    : ''

  const cvSection = candidate.cv_text
    ? `\nFULL CV TEXT:\n${candidate.cv_text.slice(0, 6000)}`
    : ''

  const fitSection = fitScore != null
    ? `\nFit score against this role: ${Math.round(fitScore)}/100`
    : ''

  const jdSection = role.notes
    ? `\nJOB DESCRIPTION:\n${role.notes}`
    : ''

  const voiceSection = voiceSamples.length
    ? `\nRECRUITER VOICE — write in this recruiter's style, not a generic recruiter's style:\n${
        voiceSamples.map((s, i) =>
          `Example ${i + 1}${s.subject ? ` (subject: "${s.subject}")` : ''}:\n${s.body.slice(0, 400)}`
        ).join('\n\n')
      }\n\nCalibrate sentence length, word choice, and tone to match these samples. Do not copy them. The examples are voice reference, not templates.`
    : ''

  const HUMAN_WRITING_RULES = `Writing rules — this must read like a sharp recruiter wrote it, not AI:
- No em dashes (—), en dashes (–), or dashes used as punctuation breaks. Use a period or comma instead.
- No: "excited to present", "pleased to introduce", "strong track record", "passionate", "self-starter", "results-driven", "dynamic", "leveraged", "spearheaded", "proven ability"
- No: "Additionally", "Furthermore", "It is worth noting", "In conclusion"
- Active voice always. "Grew revenue 40%" not "Was responsible for growing revenue"
- Write how a recruiter talks to a hiring manager, not how someone writes a cover letter
- Short sentences. Vary length. Every sentence earns its place.${voiceSection}`

  const formatInstructions = format === 'bullet'
    ? `Write a structured bullet-format submission. Use plain text bullets (no markdown). Keep each bullet under 15 words. Total under 150 words.

Structure:
[Candidate name] | [Role title] at [Company]

Background: [1 sentence: current title, company, years of experience]
Key experience:
- [most relevant achievement or role with a metric]
- [second strongest point]
- [third point if strong enough, otherwise omit]
Why this role:
- [how their background maps to the #1 requirement]
- [second mapping if there is one]
Current: [availability, location — only what you know; don't invent]`
    : `Write a narrative paragraph submission. Third person, recruiter voice. Lead with the single most compelling reason they fit. Include real metrics and specifics. Under 250 words.

Structure:
- Opening sentence: who they are and the sharpest reason they fit this specific role
- Body: 2-3 strengths mapped to the role requirements, with metrics where available
- Closing: current situation and availability (only what you know)`

  const industryLine    = role.clients?.industry ? `\nClient industry: ${role.clients.industry}`        : ''
  const clientNotesLine = role.clients?.notes    ? `\nClient notes: ${role.clients.notes.slice(0, 500)}` : ''

  const prompt = `You are an expert technical recruiter writing a candidate submission for a client or ATS.

${buildRuleZero()}

${HUMAN_WRITING_RULES}

${formatInstructions}

CANDIDATE
Name: ${candidate.first_name} ${candidate.last_name}
Current: ${candidate.current_title ?? 'Unknown'} at ${candidate.current_company ?? 'Unknown'}
Location: ${candidate.location ?? 'Not specified'}
Skills: ${skills}${fitSection}${timelineSection}${cvSection}

ROLE
Title: ${role.title}
Company: ${role.clients?.name ?? 'Unknown'}${industryLine}${clientNotesLine}${comp ? `\nComp: ${comp}` : ''}${jdSection}

Write only the submission text. No subject line, no greeting, no signature. Just the body copy the recruiter will send to the hiring manager.`

  return [{ role: 'user', content: prompt }]
}

function formatComp(min, max, type) {
  if (!min && !max) return null
  const fmt = n => `$${Number(n).toLocaleString()}`
  const range = (min && max)
    ? `${fmt(min)}-${fmt(max)}`
    : min ? `${fmt(min)}+` : `Up to ${fmt(max)}`
  const suffixes = {
    salary:             '/yr',
    hourly:             '/hr',
    contract:           '/yr',
    equity_plus_salary: '/yr + equity',
  }
  return `${range}${suffixes[type] ?? ''}`
}

// Builds submission messages from a Gemini Notes meet recap email body.
// Called when the recruiter explicitly triggers "Draft submittal" on an
// intake_notes_ready action card — not automatically on email arrival.
// Notes are primary signal; candidate record provides name/title/location context.
//
// Approved constraints: no client company name in context, explicit insufficient-signal
// escape hatch, explicit do-not-invent rule.
export function buildSubmittalFromMeetNotesMessages(candidate, role, meetNotesBody, format = 'bullet') {
  const compMin = role?.target_comp_min ?? role?.comp_min
  const compMax = role?.target_comp_max ?? role?.comp_max
  const comp = formatComp(compMin, compMax, null)
  const jdSection = role?.notes ? `\nJOB DESCRIPTION:\n${role.notes.slice(0, 3000)}` : ''

  const HUMAN_WRITING_RULES = `Writing rules — this must read like a sharp recruiter wrote it, not AI:
- No em dashes (—), en dashes (–), or dashes used as punctuation breaks. Use a period or comma instead.
- No: "excited to present", "pleased to introduce", "strong track record", "passionate", "self-starter", "results-driven", "dynamic", "leveraged", "spearheaded", "proven ability"
- No: "Additionally", "Furthermore", "It is worth noting", "In conclusion"
- Active voice always. "Grew revenue 40%" not "Was responsible for growing revenue"
- Write how a recruiter talks to a hiring manager, not how someone writes a cover letter.
- Short sentences. Vary length. Every sentence earns its place.
- Do not invent experience, metrics, or claims not explicitly present in the call notes. If a detail is not in the notes, omit it.`

  const formatInstructions = format === 'bullet'
    ? `Write a structured bullet-format submission. Use plain text bullets (no markdown). Keep each bullet under 15 words. Total under 150 words.

Structure:
[Candidate name] | [Role title]

Background: [1 sentence: current title, company, years of experience if mentioned in the call]
Key experience:
- [most relevant point from the call notes]
- [second strongest point]
- [third if strong enough, otherwise omit]
Why this role:
- [how their stated interest or background maps to the top requirement]
- [second mapping if clear from the notes]
Current: [availability, comp expectations, location — only what was stated in the call]`
    : `Write a narrative paragraph submission. Third person, recruiter voice. Lead with the single most compelling reason they fit based on the call. Use real specifics from the notes. Under 250 words.`

  const prompt = `You are an expert technical recruiter writing a candidate submission for a client.

The candidate just completed a recruiter screening call. The notes below were auto-generated by Google Gemini from the meeting recording. They are your primary signal about this candidate. Use them fully.

If the call notes do not contain enough detail to write a strong, specific submittal, output this exact line and nothing else:
"Insufficient signal for a strong submittal. Recommend a follow-up call before submitting."

${buildRuleZero()}

${HUMAN_WRITING_RULES}

${formatInstructions}

CANDIDATE
Name: ${candidate.first_name} ${candidate.last_name}
${candidate.current_title ? `Current: ${candidate.current_title} at ${candidate.current_company ?? 'unknown company'}` : ''}
${candidate.location ? `Location: ${candidate.location}` : ''}

ROLE
Title: ${role?.title ?? 'Unknown'}
${comp ? `Comp: ${comp}` : ''}${jdSection}

CALL NOTES (Gemini auto-generated from recording):
${(meetNotesBody || '').slice(0, 6000)}

Write only the submission body. No subject line. No greeting. No signature.`

  return [{ role: 'user', content: prompt }]
}
