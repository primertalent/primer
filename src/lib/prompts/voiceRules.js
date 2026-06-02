// Per-recruiter voice profile and rule-zero block for submittal and outreach prompts.
// recruiter.voice_profile overrides the default rules when present (future hook, not yet in schema).
// voiceSamples: [{ channel, subject, body }] from voice_samples table.

export function buildVoiceBlock(recruiter, voiceSamples = []) {
  const rules = recruiter?.voice_profile ||
`Voice rules — write in this recruiter's voice, not generic AI recruiter voice:
1. Facts, not characterization. State the fact. Cut the gloss. "200-300 dials/day" not "core of what the role wants." Let the hiring manager draw the conclusion.
2. Declarative, never contrast or negative framing. State what something is. "Built and scaled real businesses" not "not a financial shop, but built real businesses."
3. No clever comparisons or shorthand. "Palantir-style" gets cut. Plain operator language.
4. Prefer real numbers over adjectives. $2M expansion, 400 dials/week, 12 meetings against a 10 quota. When no number exists, a true grounded qualitative is fine — never invent a number to fill the gap.
5. Strongest signal first. Hook and outreach lead with the most compelling concrete fact.
6. Never guess a make-or-break fact. Missing deciding data → name the gap explicitly.
7. Confident, low-friction close. "Worth 30 minutes?" No hedging, no "if it's not the right time," no overselling.
8. Tight and skimmable. Short lines. No corporate filler. Outreach under 150 words.`

  const samplesBlock = voiceSamples.length
    ? `\n\nRECRUITER VOICE SAMPLES — calibrate tone to match, do not copy:\n${
        voiceSamples.map((s, i) =>
          `Sample ${i + 1}${s.subject ? ` (subject: "${s.subject}")` : ''}:\n${s.body.slice(0, 700)}`
        ).join('\n\n')
      }\n\nMatch sentence length, word choice, and energy to these samples. Do not copy them literally.`
    : ''

  return `${rules}${samplesBlock}`
}

export function buildRuleZero() {
  return `Rule zero — fabrication is forbidden:
Every claim traces to one of four sources: the resume, the call notes, the role data, or a fact the recruiter stated in this conversation.
When a make-or-break fact is missing, name the gap explicitly — write [NEEDS: <specific fact>] inline where that fact would land. Do not invent it. Do not omit it silently.
Inference is allowed and must be marked: "His resume suggests X — confirm with him" is honest. Stating X as fact when it appeared in none of the sources is fabrication.
Motivation framing is the highest fabrication risk. Use the candidate's actual stated reason, verbatim in substance. "Wants an AE path because his current company has none" is real. "Drawn to [Company]'s mission and culture" constructed from that is fabrication — never bridge the gap with invented alignment. If real motivation did not surface, write [NEEDS: candidate's stated reason for interest — confirm before sending].
When sources conflict, surface the conflict. Do not paper over it.`
}
