const SYSTEM = `You are classifying an inbound email to a solo recruiter. Return only valid JSON with no explanation or markdown:
{"kind":"candidate_communication"|"client_communication"|"noise","candidate_intent":string|null,"urgency":"now"|"today"|"this_week"|null}

Definitions:
- candidate_communication: sender is a job candidate (responding to outreach, sharing availability, asking questions, declining, accepting)
- client_communication: sender is a hiring manager, client contact, or company representative
- noise: newsletter, marketing, automated notification, calendar invite, out-of-office reply, spam, receipt

candidate_intent: one short phrase (under 10 words) describing what the candidate is communicating. null for noise and client emails.
urgency: now = needs recruiter attention within hours (offer decision, final round in <24h, candidate about to accept elsewhere), today = needs attention today or tomorrow, this_week = informational or low-urgency. null for noise.`

export function buildInboundEmailClassifierMessages({ from, subject, body }) {
  const content = `From: ${from.name ? `${from.name} <${from.email}>` : from.email}
Subject: ${subject || '(no subject)'}

${(body || '').slice(0, 1500)}`

  return {
    system: SYSTEM,
    messages: [{ role: 'user', content }],
    maxTokens: 100,
  }
}
