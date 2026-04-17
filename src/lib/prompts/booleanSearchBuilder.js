// Returns JSON: { linkedin: string, google: string, github: string }
export function buildBooleanSearchMessages(role) {
  const skills = Array.isArray(role.skills)
    ? role.skills
    : extractSkillsFromNotes(role.notes)

  const skillsText = skills.length ? skills.join(', ') : 'Not specified'
  const jdSection = role.notes ? `\nJOB DESCRIPTION:\n${role.notes.slice(0, 3000)}` : ''

  const comp = role.comp_min || role.comp_max
    ? formatComp(role.comp_min, role.comp_max, role.comp_type)
    : null

  const isTechnical = isTechnicalRole(role.title, role.notes)

  const prompt = `You are an expert technical recruiter and sourcing specialist who has made 1,000+ placements using Boolean search. You generate precise, immediately-usable Boolean search strings that find the right candidates fast.

Boolean syntax rules:
- Use AND to require terms: "Python" AND "AWS"
- Use OR for synonyms/alternates: ("VP Engineering" OR "Head of Engineering" OR "Director of Engineering")
- Use NOT to exclude noise: NOT "freelance" NOT "consultant" NOT "looking for opportunities"
- Use quotes for exact phrases: "software engineer" (not software engineer)
- Group OR terms in parentheses: (term1 OR term2 OR term3)
- Combine required groups: (titles) AND (skills) AND (location if needed)

Generate 3 search strings:

1. LINKEDIN — For LinkedIn Recruiter or LinkedIn search bar. Use full Boolean syntax with AND/OR/NOT. Include title variations, key skills, and relevant seniority indicators. Aim for 100-500 results (sweet spot for manual outreach). Add NOT exclusions for noise like "freelance", "consultant", "open to work" if appropriate.

2. GOOGLE X-RAY — For Google search to find LinkedIn profiles not showing in LinkedIn search. Start with: site:linkedin.com/in/ then Boolean terms. Exclude LinkedIn's own pages: -intitle:"profiles" -inurl:"dir/". Keep it clean and immediately pasteable into Google.

3. GITHUB — ${isTechnical ? 'For technical roles: search by relevant programming languages, location if applicable, follower count as quality signal. Example: language:python language:go location:"San Francisco" followers:>50' : 'Not applicable for this role — return an empty string.'}

Make each string immediately usable — no placeholders, no instructions inside the string, just the search syntax. Tailor everything specifically to this role based on the title, skills, and JD context.

ROLE
Title: ${role.title}
Client: ${role.clients?.name ?? 'Unknown'}${comp ? `\nComp: ${comp}` : ''}
Skills / Requirements: ${skillsText}${jdSection}

Return ONLY a valid JSON object, no markdown, no explanation:
{
  "linkedin": "<complete LinkedIn Boolean search string>",
  "google": "<complete Google X-ray search string>",
  "github": "<GitHub search string, or empty string if not a technical role>"
}`

  return [{ role: 'user', content: prompt }]
}

function isTechnicalRole(title, notes) {
  const technical = /engineer|developer|architect|data|backend|frontend|fullstack|full.stack|devops|platform|infrastructure|ml|ai|machine learning|software|systems/i
  return technical.test(title ?? '') || technical.test(notes ?? '')
}

function extractSkillsFromNotes(notes) {
  if (!notes) return []
  // Simple keyword extraction — real skills parsing comes from the screener
  const commonSkills = ['Python', 'JavaScript', 'TypeScript', 'Go', 'Rust', 'Java', 'C++', 'React',
    'Node', 'AWS', 'GCP', 'Azure', 'Kubernetes', 'Docker', 'SQL', 'PostgreSQL', 'Salesforce',
    'Figma', 'Product', 'Sales', 'Marketing', 'Finance', 'Legal', 'HR', 'Operations']
  const notesLower = notes.toLowerCase()
  return commonSkills.filter(s => notesLower.includes(s.toLowerCase())).slice(0, 5)
}

function formatComp(min, max, type) {
  if (!min && !max) return null
  const fmt = n => `$${Number(n).toLocaleString()}`
  const range = (min && max) ? `${fmt(min)}-${fmt(max)}` : min ? `${fmt(min)}+` : `Up to ${fmt(max)}`
  const suffixes = { salary: '/yr', hourly: '/hr', contract: '/yr', equity_plus_salary: '/yr + equity' }
  return `${range}${suffixes[type] ?? ''}`
}
