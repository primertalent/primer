import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useRecruiter } from '../hooks/useRecruiter'
import AppLayout from '../components/AppLayout'
import { generateText } from '../lib/ai'
import { buildNextActionMessages } from '../lib/prompts/nextAction'

// ── Helpers ───────────────────────────────────────────────

const SOURCE_LABELS = {
  sourced: 'Sourced',
  inbound: 'Inbound',
  referral: 'Referral',
  job_board: 'Job Board',
  other: 'Other',
}

const TYPE_LABELS = {
  email: 'Email',
  linkedin: 'LinkedIn',
  text: 'Text',
  call: 'Call',
  note: 'Note',
  meeting: 'Meeting',
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDateShort(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ── Sub-components ────────────────────────────────────────

function DetailRow({ label, value }) {
  if (!value) return null
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  )
}

function SkillTags({ skills }) {
  if (!skills?.length) return <span className="detail-value muted">None listed</span>
  return (
    <div className="skill-tags">
      {skills.map(skill => (
        <span key={skill} className="skill-tag">{skill}</span>
      ))}
    </div>
  )
}

function PipelineEntry({ entry }) {
  const roleName = entry.roles?.title ?? 'Unknown role'
  const clientName = entry.roles?.clients?.name ?? 'Unknown client'

  return (
    <div className="pipeline-entry">
      <div className="pipeline-role">
        <span className="pipeline-role-title">{roleName}</span>
        <span className="pipeline-client">{clientName}</span>
      </div>
      <div className="pipeline-meta">
        <span className="stage-badge">{entry.current_stage}</span>
        {entry.fit_score != null && (
          <span className="fit-score">{Math.round(entry.fit_score)}<span className="fit-denom">/100</span></span>
        )}
      </div>
      {entry.next_action && (
        <div className="pipeline-next-action">
          <span className="detail-label">Next action</span>
          <span className="detail-value">{entry.next_action}</span>
          {entry.next_action_due_at && (
            <span className="due-date">Due {formatDateShort(entry.next_action_due_at)}</span>
          )}
        </div>
      )}
    </div>
  )
}

function InteractionEntry({ interaction }) {
  return (
    <div className="interaction-entry">
      <div className="interaction-meta">
        <span className="interaction-type">{TYPE_LABELS[interaction.type] ?? interaction.type}</span>
        {interaction.direction && (
          <span className="interaction-direction">{interaction.direction}</span>
        )}
        <span className="interaction-date">{formatDate(interaction.occurred_at)}</span>
      </div>
      {interaction.subject && (
        <p className="interaction-subject">{interaction.subject}</p>
      )}
      {interaction.body && (
        <p className="interaction-body">{interaction.body}</p>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────

export default function CandidateCard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { recruiter } = useRecruiter()

  const [candidate, setCandidate] = useState(null)
  const [pipelines, setPipelines] = useState([])
  const [interactions, setInteractions] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [suggestion, setSuggestion] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState(null)

  useEffect(() => {
    if (!id) return

    async function fetchAll() {
      // Log auth state and recruiter context for debugging
      const { data: { user: authUser } } = await supabase.auth.getUser()
      console.debug('[CandidateCard] auth user id:', authUser?.id)
      console.debug('[CandidateCard] recruiter row:', recruiter)
      console.debug('[CandidateCard] fetching candidate id:', id)

      const [candidateRes, pipelineRes, interactionRes] = await Promise.all([
        supabase
          .from('candidates')
          .select('*')
          .eq('id', id)
          .single(),

        supabase
          .from('pipeline')
          .select(`
            *,
            roles (
              title,
              clients ( name )
            )
          `)
          .eq('candidate_id', id),

        supabase
          .from('interactions')
          .select('*')
          .eq('candidate_id', id)
          .order('occurred_at', { ascending: true }),
      ])

      console.debug('[CandidateCard] candidate result:', {
        data: candidateRes.data,
        error: candidateRes.error,
        // PGRST116 = no rows returned (RLS filtered it out or ID doesn't exist)
        errorCode: candidateRes.error?.code,
        errorMessage: candidateRes.error?.message,
      })
      console.debug('[CandidateCard] pipeline result:', {
        count: pipelineRes.data?.length,
        error: pipelineRes.error,
      })
      console.debug('[CandidateCard] interactions result:', {
        count: interactionRes.data?.length,
        error: interactionRes.error,
      })

      if (candidateRes.error || !candidateRes.data) {
        console.warn(
          '[CandidateCard] candidate not accessible — likely RLS mismatch.\n' +
          'Check that the candidate\'s recruiter_id in Supabase matches recruiter.id above.\n' +
          'Error code:', candidateRes.error?.code,
          '| Message:', candidateRes.error?.message
        )
        setNotFound(true)
      } else {
        setCandidate(candidateRes.data)
        setPipelines(pipelineRes.data ?? [])
        setInteractions(interactionRes.data ?? [])
      }

      setLoading(false)
    }

    fetchAll()
  }, [id, recruiter])

  async function handleGenerateNextAction() {
    if (!candidate) return
    setSuggestion(null)
    setGenError(null)
    setGenerating(true)

    try {
      const messages = buildNextActionMessages(candidate, pipelines, interactions)
      const text = await generateText({ messages })
      setSuggestion(text || 'No suggestion returned.')
    } catch (err) {
      setGenError(err.message ?? 'Failed to generate suggestion.')
    } finally {
      setGenerating(false)
    }
  }

  // ── Render states ────────────────────────────────────────

  if (loading) {
    return <AppLayout><p className="muted">Loading…</p></AppLayout>
  }

  if (notFound) {
    return (
      <AppLayout>
        <p className="muted">Candidate not found.</p>
        <button className="btn-ghost" style={{ marginTop: 16 }} onClick={() => navigate(-1)}>
          Go back
        </button>
      </AppLayout>
    )
  }

  const fullName = `${candidate.first_name} ${candidate.last_name}`

  return (
    <AppLayout>

        {/* Page header */}
        <div className="page-header">
          <div className="page-header-left">
            <button className="btn-back" onClick={() => navigate(-1)}>← Back</button>
            <div>
              <h1 className="page-title">{fullName}</h1>
              {candidate.current_title && candidate.current_company && (
                <p className="page-subtitle">{candidate.current_title} · {candidate.current_company}</p>
              )}
            </div>
          </div>
          <button
            className="btn-primary"
            onClick={handleGenerateNextAction}
            disabled={generating}
          >
            {generating ? 'Generating…' : 'Generate Next Action'}
          </button>
        </div>

        {/* AI suggestion */}
        {(suggestion || genError) && (
          <div className={`ai-card ${genError ? 'ai-card--error' : ''}`}>
            <p className="ai-card-eyebrow">
              {genError ? 'Error' : 'Suggested Next Action'}
            </p>
            <p className="ai-card-body">{genError || suggestion}</p>
          </div>
        )}

        {/* Two-column layout */}
        <div className="candidate-columns">

          {/* Left: Candidate details */}
          <section className="candidate-section">
            <h2 className="section-heading">Candidate Details</h2>
            <DetailRow label="Email" value={candidate.email} />
            <DetailRow label="Phone" value={candidate.phone} />
            <DetailRow
              label="LinkedIn"
              value={candidate.linkedin_url
                ? <a href={candidate.linkedin_url} target="_blank" rel="noreferrer">{candidate.linkedin_url}</a>
                : null}
            />
            <DetailRow label="Location" value={candidate.location} />
            <DetailRow label="Source" value={SOURCE_LABELS[candidate.source] ?? candidate.source} />
            <div className="detail-row">
              <span className="detail-label">Skills</span>
              <SkillTags skills={candidate.skills} />
            </div>
            {candidate.notes && (
              <div className="detail-row detail-row--block">
                <span className="detail-label">Notes</span>
                <p className="detail-notes">{candidate.notes}</p>
              </div>
            )}
          </section>

          {/* Right: Pipeline status */}
          <section className="candidate-section">
            <h2 className="section-heading">Pipeline</h2>
            {pipelines.length === 0 ? (
              <p className="muted">Not in any pipeline yet.</p>
            ) : (
              pipelines.map(entry => (
                <PipelineEntry key={entry.id} entry={entry} />
              ))
            )}
          </section>

        </div>

        {/* Interaction history */}
        <section className="candidate-section" style={{ marginTop: 24 }}>
          <h2 className="section-heading">Interaction History</h2>
          {interactions.length === 0 ? (
            <p className="muted">No interactions recorded yet.</p>
          ) : (
            <div className="interaction-feed">
              {interactions.map(i => (
                <InteractionEntry key={i.id} interaction={i} />
              ))}
            </div>
          )}
        </section>

    </AppLayout>
  )
}
