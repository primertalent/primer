// Returns plain text: a complete, formatted job description
// Input: rough notes, bullets, scraped JD, or partial description
export function buildJobDescriptionMessages(rawInput, role) {
  const titleHint = role?.title ? `Role title: ${role.title}` : ''
  const clientHint = role?.clients?.name ? `Company: ${role.clients.name}` : ''
  const compHint =
    role?.comp_min != null && role?.comp_max != null
      ? `Compensation: $${role.comp_min.toLocaleString()} – $${role.comp_max.toLocaleString()} ${role.comp_type ?? ''}`
      : role?.comp_min != null
      ? `Compensation: from $${role.comp_min.toLocaleString()} ${role.comp_type ?? ''}`
      : ''

  const context = [titleHint, clientHint, compHint].filter(Boolean).join('\n')

  const prompt = `You are an expert technical recruiter and copywriter. Your job is to transform rough notes, intake scribbles, or a scraped JD into a clean, compelling job description that attracts qualified candidates and repels unqualified ones.

Writing rules:
- Direct, specific, human. No corporate buzzwords.
- No em dashes (—). Use commas, colons, or line breaks instead.
- No filler phrases: "fast-paced environment", "passionate", "rockstar", "ninja", "synergy", "leverage", "world-class", "best-in-class"
- Every bullet must be a specific, concrete thing this person will actually do or need
- Salary transparent — if provided, include it. If not, omit the range but keep the benefits section
- 600-800 words total
- Action verbs for responsibilities: Build, Own, Drive, Define, Ship, Lead, Partner, Improve
- Optimized for Boolean search: use the actual keywords recruiters search (exact tool names, role-specific terminology)

JD structure (output in this exact order, use these exact section headers):

**[Job Title]**

**Role Summary**
2-3 sentences. What the company does, what this role owns, and why it matters. Specific, not vague.

**What You'll Do**
4-5 bullets, each starting with an action verb. Concrete, specific tasks. No generalities.

**What We're Looking For**
Must-haves (3-5 bullets): hard requirements, years of experience, tools, domains. Label them clearly.
Nice-to-haves (2-3 bullets): labeled separately.

**Why Join Us**
Compensation (if known), benefits, actual reasons a good candidate would choose this over other offers. If no comp data, skip the range and list what you can.

**Ideal Candidate Profile**
3-4 sentences. Paint a picture of the person who will thrive here — their mindset, background, and approach. Not a requirements list. This is the "who are you" section.

---

${context ? `ROLE CONTEXT:\n${context}\n\n` : ''}RAW INPUT:
${rawInput}

---

Write the complete job description now. Plain text only, no JSON, no markdown code fences. Use **bold** for section headers only.`

  return [{ role: 'user', content: prompt }]
}
