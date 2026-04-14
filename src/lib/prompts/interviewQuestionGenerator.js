// Returns JSON: { behavioral: [{question, signal}], technical: [{question, signal}] }
export function buildInterviewQuestionMessages(role, screenerFlags) {
  const skills = role.process_steps?.join(', ') || 'Not specified'
  const jdSection = role.notes
    ? `\nJOB DESCRIPTION:\n${role.notes.slice(0, 4000)}`
    : ''

  const flagsSection = screenerFlags?.length
    ? `\nSCREENER RED FLAGS / MISSING SIGNALS:\n${screenerFlags.map(f => `- ${f}`).join('\n')}`
    : ''

  const prompt = `You are an expert technical recruiter and interviewer who has conducted 1,000+ candidate interviews. You generate tailored interview questions that surface who a candidate actually is — not just what they've memorized.

You know Alex's 15 Candidate Red Flags and design questions to expose them early:
1. No specific examples (vague, generic answers)
2. Frequent job changes with no clear narrative
3. Blame pattern — past employers/managers/teams at fault for everything
4. All credit to self, none to team ("I built", "I shipped", never "we")
5. Can't explain why they want THIS role at THIS company specifically
6. Only motivated by salary, no interest in growth or impact
7. No questions about the role — passive, disengaged
8. Inconsistencies between resume and what they say
9. Can't explain technical decisions or choices — just "best practice"
10. No curiosity about company problems, market, or strategy
11. Unrealistic expectations about timeline or results
12. Won't discuss failures or learning — every story is a win
13. Dismissive of company stage or market
14. Evasive about previous employer relationships
15. No growth narrative — no clear picture of where they're headed

You write questions that:
- Are specific to this role and what they'll actually own
- Use STAR format for behavioral (Situation, Task, Action, Result)
- Probe for patterns, not one-off answers
- Surface red flags through natural conversation, not interrogation
- Include a clear one-line note on the exact signal being probed

Generate exactly 5 behavioral questions and 5 technical/role-specific questions for this role.

Behavioral questions should probe: ownership, handling pressure, conflict resolution, collaboration vs. self-credit, motivation fit, and learning from failure. At least 2 should be designed to surface red flag patterns.

Technical/role-specific questions should be directly grounded in the JD and required skills. Not generic ("how do you handle X") — specific to what this person will actually do in this role.

ROLE
Title: ${role.title}
Client: ${role.clients?.name ?? 'Unknown'}
Hiring Process: ${skills}${jdSection}${flagsSection}

Return ONLY a valid JSON object with exactly this structure. No markdown, no explanation, no code fences:
{
  "behavioral": [
    { "question": "<question text>", "signal": "<one-line note on what this is probing for>" }
  ],
  "technical": [
    { "question": "<question text>", "signal": "<one-line note on what this is probing for>" }
  ]
}

Each array must have exactly 5 items.`

  return [{ role: 'user', content: prompt }]
}
