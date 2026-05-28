// format: 'email' | 'bullet'
// voiceSamples: optional [{ channel, subject, body }] from voice_samples table — calibrates tone to the recruiter's style.
export function buildSubmissionMessages(candidate, role, fitScore, format = 'email', voiceSamples = []) {
  const skills = candidate.skills?.join(', ') || 'None listed'
  const comp = formatComp(role.comp_min, role.comp_max, role.comp_type)

  const timelineSection = candidate.career_timeline?.length
    ? `\nCAREER TIMELINE (parsed):\n${candidate.career_timeline
        .map(e => `- ${e.title} at ${e.company} (${e.start} – ${e.end ?? 'Present'})${
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

  const prompt = `You are an expert technical recruiter writing a candidate submission for a client or ATS.

${HUMAN_WRITING_RULES}

${formatInstructions}

CANDIDATE
Name: ${candidate.first_name} ${candidate.last_name}
Current: ${candidate.current_title ?? 'Unknown'} at ${candidate.current_company ?? 'Unknown'}
Location: ${candidate.location ?? 'Not specified'}
Skills: ${skills}${fitSection}${timelineSection}${cvSection}

ROLE
Title: ${role.title}
Company: ${role.clients?.name ?? 'Unknown'}${comp ? `\nComp: ${comp}` : ''}${jdSection}

Write only the submission text. No subject line, no greeting, no signature. Just the body copy the recruiter will send to the hiring manager.`

  return [{ role: 'user', content: prompt }]
}

function formatComp(min, max, type) {
  if (!min && !max) return null
  const fmt = n => `$${Number(n).toLocaleString()}`
  const range = (min && max)
    ? `${fmt(min)} – ${fmt(max)}`
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
