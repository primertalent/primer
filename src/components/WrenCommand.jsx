import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import mammoth from 'mammoth'
import { supabase } from '../lib/supabase'
import { useRecruiter } from '../hooks/useRecruiter'
import { generateText } from '../lib/ai'
import { buildIntakeMessages, buildClassifyMessages } from '../lib/prompts/intake'
import { buildMultiScreenMessages } from '../lib/prompts/multiScreen'
import { buildSubmissionMessages } from '../lib/prompts/submissionDraft'
import { buildCvPdfMessages } from '../lib/prompts/cvExtraction'
import { useAgent } from '../context/AgentContext'

// ── Helpers ───────────────────────────────────────────────

function parseName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/)
  return {
    first_name: parts[0] || 'Unknown',
    last_name: parts.slice(1).join(' ') || '—',
  }
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text) } catch {}
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function parseJson(text) {
  try { return JSON.parse(text) } catch {}
  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
  } catch {}
  return null
}

const CHIP_ICONS = {
  resume:     '📄',
  jd:         '📋',
  transcript: '🎙️',
  notes:      '📝',
  url:        '🔗',
}

// ── IntakeResult ──────────────────────────────────────────

function SignalRow({ label, value }) {
  if (!value) return null
  return (
    <div className="intake-signal-row">
      <span className="intake-signal-label">{label}</span>
      <span className="intake-signal-value">{value}</span>
    </div>
  )
}

function IntakeResult({ result, recruiter, jdChips = [], onClear, onSaved }) {
  const [saving, setSaving]            = useState(false)
  const [saved, setSaved]              = useState(false)
  const [savedCandidateId, setSavedId] = useState(null)
  const [savedRoleId, setSavedRoleId]  = useState(null)
  const [saveError, setSaveError]      = useState(null)
  const [copied, setCopied]            = useState(null)

  // Auto-save on mount
  useEffect(() => { handleSaveAll() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { candidate_present, candidate: c, role: r, screening: s, pitch, call_log, next_actions, freeform_answer } = result
  // Treat as candidate-present if the field is missing (older prompt responses) or explicitly true
  const hasCandidate = candidate_present !== false && !!(c?.name || c?.email || c?.cv_text)

  async function handleCopy(type) {
    if (type === 'pitch')   await copyText(pitch?.one_liner || '')
    if (type === 'bullets') await copyText((pitch?.bullets || []).map(b => `• ${b}`).join('\n'))
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  async function handleSaveAll() {
    if (!recruiter?.id) return
    setSaving(true)
    setSaveError(null)

    try {
      let candidateId = null

      if (hasCandidate) {
        const { first_name, last_name } = parseName(c?.name)
        let existing = null

        if (c?.email) {
          const { data } = await supabase
            .from('candidates').select('id, enrichment_data')
            .eq('recruiter_id', recruiter.id).eq('email', c.email)
            .maybeSingle()
          existing = data
        }
        if (!existing && c?.name) {
          const { data } = await supabase
            .from('candidates').select('id, enrichment_data')
            .eq('recruiter_id', recruiter.id)
            .eq('first_name', first_name).eq('last_name', last_name)
            .maybeSingle()
          existing = data
        }

        const mergedEnrichment = {
          ...(existing?.enrichment_data || {}),
          ...(c?.signals        && { signals: c.signals }),
          ...(c?.career_summary && { career_summary: c.career_summary }),
          ...(pitch?.one_liner  && { intake_pitch: pitch.one_liner }),
          ...(pitch?.bullets?.length && { intake_bullets: pitch.bullets }),
        }

        const candidatePayload = {
          recruiter_id: recruiter.id,
          first_name,
          last_name,
          ...(c?.email           && { email: c.email }),
          ...(c?.current_title   && { current_title: c.current_title }),
          ...(c?.current_company && { current_company: c.current_company }),
          ...(c?.cv_text         && { cv_text: c.cv_text }),
          enrichment_data: mergedEnrichment,
        }

        if (existing) {
          await supabase.from('candidates').update(candidatePayload).eq('id', existing.id)
          candidateId = existing.id
        } else {
          const { data, error } = await supabase
            .from('candidates').insert(candidatePayload).select('id').single()
          if (error) throw error
          candidateId = data.id
        }
      }

      let savedRoleId = null
      if (r?.title && r?.company) {
        let clientId
        const { data: existingClient } = await supabase
          .from('clients').select('id')
          .eq('recruiter_id', recruiter.id).ilike('name', r.company)
          .maybeSingle()

        if (existingClient) {
          clientId = existingClient.id
        } else {
          const { data, error } = await supabase
            .from('clients')
            .insert({ recruiter_id: recruiter.id, name: r.company, ...(r.location && { hq_location: r.location }) })
            .select('id').single()
          if (error) throw error
          clientId = data.id
        }

        if (r.role_id) {
          savedRoleId = r.role_id
        } else {
          const { data: existingRole } = await supabase
            .from('roles').select('id')
            .eq('recruiter_id', recruiter.id).eq('client_id', clientId).ilike('title', r.title)
            .maybeSingle()

          if (existingRole) {
            savedRoleId = existingRole.id
          } else {
            const jdText = jdChips[0]?.content ?? null
            const { data, error } = await supabase
              .from('roles')
              .insert({
                recruiter_id: recruiter.id,
                client_id: clientId,
                title: r.title,
                status: 'open',
                process_steps: ['Sourced', 'Screen', 'Hiring Manager', 'Final Round', 'Offer', 'Placed'],
                ...(jdText && { notes: jdText }),
              })
              .select('id').single()
            if (error) throw error
            savedRoleId = data.id
          }
        }

        if (candidateId) {
          const fitScore = s?.score ? Math.min(100, Math.round(s.score * 10)) : null
          const { error: pipeErr } = await supabase.from('pipeline').upsert(
            {
              recruiter_id: recruiter.id,
              candidate_id: candidateId,
              role_id: savedRoleId,
              current_stage: 'Sourced',
              status: 'active',
              ...(fitScore != null && { fit_score: fitScore }),
              ...(s?.reasoning    && { fit_score_rationale: s.reasoning }),
            },
            { onConflict: 'candidate_id,role_id' }
          )
          if (pipeErr) throw pipeErr
        }
      }

      if (call_log?.summary && candidateId) {
        await supabase.from('interactions').insert({
          recruiter_id: recruiter.id,
          candidate_id: candidateId,
          type: 'call',
          subject: 'Intake call',
          body: call_log.raw_transcript || call_log.summary,
          occurred_at: new Date().toISOString(),
        })
      }

      setSaved(true)
      setSavedId(candidateId)
      setSavedRoleId(savedRoleId)
      onSaved?.({ candidateId, roleId: savedRoleId, candidate: c, role: r, screening: s })
    } catch (err) {
      console.error('Save All failed:', err)
      setSaveError('Save failed. Check console.')
    } finally {
      setSaving(false)
    }
  }

  const hasBullets     = pitch?.bullets?.length > 0
  const hasNextActions = next_actions?.length > 0
  const concerns       = c?.signals?.red_flags ?? []

  return (
    <div className="intake-result">

      {/* Hero: name + score */}
      <div className="intake-hero">
        <div className="intake-hero-left">
          <p className="intake-hero-name">
            {hasCandidate ? (c?.name || 'Unknown Candidate') : (r?.title ? `${r.title}${r.company ? ` · ${r.company}` : ''}` : 'Role saved')}
            {saved && savedCandidateId && (
              <span className="intake-saved-links">
                <Link to={`/network/${savedCandidateId}`} className="intake-saved-link">View</Link>
                <Link to={`/network/${savedCandidateId}/edit`} className="intake-saved-link">Edit</Link>
              </span>
            )}
            {saved && !savedCandidateId && savedRoleId && (
              <span className="intake-saved-links">
                <Link to={`/roles/${savedRoleId}`} className="intake-saved-link">View role</Link>
              </span>
            )}
          </p>
          {(c?.current_title || c?.current_company) && (
            <p className="intake-hero-meta">{[c.current_title, c.current_company].filter(Boolean).join(' · ')}</p>
          )}
          {r?.title && (
            <p className="intake-hero-role">{r.title}{r.company ? ` · ${r.company}` : ''}</p>
          )}
        </div>
        <div className="intake-hero-right">
          {s?.score > 0 && (
            <div className="intake-hero-score">
              <span className="intake-hero-score-value">{s.score}</span>
              <span className="intake-hero-score-denom">/10</span>
            </div>
          )}
          <button className="btn-ghost btn-sm" onClick={onClear}>✕</button>
        </div>
      </div>

      {/* Strengths */}
      {hasBullets && (
        <div className="intake-packet-row">
          <p className="intake-packet-label">Strengths</p>
          <ul className="intake-packet-list intake-packet-list--strengths">
            {pitch.bullets.slice(0, 3).map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>
      )}

      {/* Concerns */}
      {concerns.length > 0 && (
        <div className="intake-packet-row">
          <p className="intake-packet-label intake-packet-label--concern">Concerns</p>
          <ul className="intake-packet-list intake-packet-list--concerns">
            {concerns.slice(0, 2).map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      )}

      {/* Next action — prominent */}
      {hasNextActions && (
        <div className="intake-next-action-block">
          <p className="intake-next-action-label">Next Action</p>
          <p className="intake-next-action-text">{next_actions[0]}</p>
        </div>
      )}

      {/* Freeform answer */}
      {freeform_answer && (
        <div className="intake-packet-row">
          <p className="intake-packet-label">Answer</p>
          <p className="intake-freeform">{freeform_answer}</p>
        </div>
      )}

      <div className="intake-actions">
        <div className="intake-actions-right">
          {saving && <span className="intake-save-status">Saving…</span>}
          {saveError && (
            <>
              <span className="intake-save-error">Couldn't save.</span>
              <button className="btn-ghost btn-sm" onClick={handleSaveAll}>Try again</button>
            </>
          )}
          {saved && (
            <>
              <span className="saved-label">Saved ✓</span>
              {savedCandidateId && (
                <Link to={`/network/${savedCandidateId}`} className="btn-ghost btn-sm">View Candidate →</Link>
              )}
              {!savedCandidateId && savedRoleId && (
                <Link to={`/roles/${savedRoleId}`} className="btn-ghost btn-sm">View Role →</Link>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── MultiScreenResult ─────────────────────────────────────

const REC_LABEL = { advance: 'Advance', 'hold/advance': 'Hold → Advance', hold: 'Hold', 'hold/pass': 'Hold → Pass', pass: 'Pass' }
const REC_CLASS = { advance: 'screener-rec--advance', 'hold/advance': 'screener-rec--hold', hold: 'screener-rec--hold', 'hold/pass': 'screener-rec--hold', pass: 'screener-rec--pass' }

function MultiScreenResult({ result, recruiter, jdChips = [], onClear, onSaved }) {
  const [saving, setSaving]            = useState(false)
  const [saved, setSaved]              = useState(false)
  const [savedCandidateId, setSavedId] = useState(null)
  const [saveError, setSaveError]      = useState(null)

  // Auto-save on mount
  useEffect(() => { handleSaveAll() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Per-role pitch state: { [rank]: { phase, email, bullets, emailCopied, bulletsCopied, emailSaved, bulletsSaved } }
  const [pitches, setPitches] = useState({})

  const c        = result.candidate
  const rankings = result.rankings ?? []

  async function handleSaveAll() {
    if (!recruiter?.id) return
    setSaving(true)
    setSaveError(null)

    try {
      // ── Candidate ──────────────────────────────────────
      const { first_name, last_name } = parseName(c?.name)
      let existing = null

      if (c?.email) {
        const { data } = await supabase
          .from('candidates').select('id')
          .eq('recruiter_id', recruiter.id).eq('email', c.email)
          .maybeSingle()
        existing = data
      }
      if (!existing && c?.name) {
        const { data } = await supabase
          .from('candidates').select('id')
          .eq('recruiter_id', recruiter.id)
          .eq('first_name', first_name).eq('last_name', last_name)
          .maybeSingle()
        existing = data
      }

      const candidatePayload = {
        recruiter_id: recruiter.id,
        first_name,
        last_name,
        ...(c?.email           && { email: c.email }),
        ...(c?.current_title   && { current_title: c.current_title }),
        ...(c?.current_company && { current_company: c.current_company }),
        ...(c?.cv_text         && { cv_text: c.cv_text }),
      }

      let candidateId
      if (existing) {
        await supabase.from('candidates').update(candidatePayload).eq('id', existing.id)
        candidateId = existing.id
      } else {
        const { data, error } = await supabase
          .from('candidates').insert(candidatePayload).select('id').single()
        if (error) throw error
        candidateId = data.id
      }

      // ── Per-role: client → role → pipeline → screener_result ──
      for (const ranking of rankings) {
        if (!ranking.company || !ranking.role_title) continue

        // Client
        let clientId
        const { data: existingClient } = await supabase
          .from('clients').select('id')
          .eq('recruiter_id', recruiter.id).ilike('name', ranking.company)
          .maybeSingle()

        if (existingClient) {
          clientId = existingClient.id
        } else {
          const { data, error } = await supabase
            .from('clients')
            .insert({ recruiter_id: recruiter.id, name: ranking.company })
            .select('id').single()
          if (error) throw error
          clientId = data.id
        }

        // Role
        let roleId
        const { data: existingRole } = await supabase
          .from('roles').select('id')
          .eq('recruiter_id', recruiter.id).eq('client_id', clientId).ilike('title', ranking.role_title)
          .maybeSingle()

        if (existingRole) {
          roleId = existingRole.id
        } else {
          // Match the JD chip by looking for one whose content mentions this role title
          const titleLower = ranking.role_title.toLowerCase()
          const matchedChip = jdChips.find(chip =>
            chip.content?.toLowerCase().includes(titleLower)
          ) ?? jdChips.find(chip =>
            chip.content?.toLowerCase().includes(ranking.company.toLowerCase())
          ) ?? null
          const { data, error } = await supabase
            .from('roles')
            .insert({
              recruiter_id: recruiter.id,
              client_id: clientId,
              title: ranking.role_title,
              status: 'open',
              process_steps: ['Sourced', 'Screen', 'Hiring Manager', 'Final Round', 'Offer', 'Placed'],
              ...(matchedChip?.content && { notes: matchedChip.content }),
            })
            .select('id').single()
          if (error) throw error
          roleId = data.id
        }

        // Pipeline
        const fitScore = ranking.match_score != null
          ? Math.min(100, Math.round(ranking.match_score * 10))
          : null

        await supabase.from('pipeline').upsert(
          {
            recruiter_id: recruiter.id,
            candidate_id: candidateId,
            role_id: roleId,
            current_stage: 'Sourced',
            status: 'active',
            ...(fitScore != null && { fit_score: fitScore }),
          },
          { onConflict: 'candidate_id,role_id' }
        )

        // Screener result
        await supabase.from('screener_results').insert({
          recruiter_id: recruiter.id,
          candidate_id: candidateId,
          role_id: roleId,
          result: {
            match_score: ranking.match_score,
            recommendation: ranking.recommendation,
            recommendation_reason: ranking.why,
            top_strengths: ranking.strengths ?? [],
            top_concerns: ranking.gaps ?? [],
            skills_match: [],
            red_flags: [],
          },
        })
      }

      setSaved(true)
      setSavedId(candidateId)
      onSaved?.({ candidateId, candidate: c, rankings })
    } catch (err) {
      console.error('MultiScreen Save All failed:', err)
      setSaveError('Couldn\'t save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleGeneratePitch(ranking) {
    const key = ranking.rank
    setPitches(prev => ({ ...prev, [key]: { phase: 'generating', email: '', bullets: '', emailCopied: false, bulletsCopied: false, emailSaved: false, bulletsSaved: false } }))

    try {
      const { first_name, last_name } = parseName(c?.name)
      const pseudoCandidate = {
        first_name, last_name,
        current_title:   c?.current_title   ?? null,
        current_company: c?.current_company ?? null,
        cv_text:         c?.cv_text         ?? null,
        skills: [], career_timeline: null, location: null,
      }

      const titleLower = ranking.role_title.toLowerCase()
      const matchedChip = jdChips.find(chip =>
        chip.content?.toLowerCase().includes(titleLower)
      ) ?? jdChips.find(chip =>
        chip.content?.toLowerCase().includes(ranking.company?.toLowerCase())
      ) ?? null

      const pseudoRole = {
        title: ranking.role_title,
        clients: { name: ranking.company },
        notes: matchedChip?.content ?? null,
        comp_min: null, comp_max: null, comp_type: null,
      }

      const fitScore = ranking.match_score != null
        ? Math.min(100, Math.round(ranking.match_score * 10))
        : null

      const [emailText, bulletsText] = await Promise.all([
        generateText({ messages: buildSubmissionMessages(pseudoCandidate, pseudoRole, fitScore, 'email'), maxTokens: 1024 }),
        generateText({ messages: buildSubmissionMessages(pseudoCandidate, pseudoRole, fitScore, 'bullet'), maxTokens: 512 }),
      ])

      setPitches(prev => ({ ...prev, [key]: { phase: 'done', email: emailText.trim(), bullets: bulletsText.trim(), emailCopied: false, bulletsCopied: false, emailSaved: false, bulletsSaved: false } }))
    } catch {
      setPitches(prev => ({ ...prev, [key]: { phase: 'error', email: '', bullets: '', emailCopied: false, bulletsCopied: false, emailSaved: false, bulletsSaved: false } }))
    }
  }

  async function handleSavePitchToQueue(ranking, text) {
    if (!text || !savedCandidateId) return
    const subject = `${c?.name ?? 'Candidate'} — ${ranking.role_title ?? 'Submission'}`
    await supabase.from('messages').insert({
      recruiter_id: recruiter.id,
      candidate_id: savedCandidateId,
      channel:      'email',
      subject,
      body:         text,
      status:       'drafted',
    })
  }

  async function handleSavePitchToCandidate(ranking, key) {
    if (!savedCandidateId) return
    const roleKey = (ranking.role_title ?? 'role').replace(/\W+/g, '_').toLowerCase()
    const { data: existing } = await supabase
      .from('candidates')
      .select('enrichment_data')
      .eq('id', savedCandidateId)
      .single()
    const merged = {
      ...(existing?.enrichment_data ?? {}),
      [`pitch_${roleKey}_email`]:   pitches[key].email,
      [`pitch_${roleKey}_bullets`]: pitches[key].bullets,
    }
    await supabase.from('candidates').update({ enrichment_data: merged }).eq('id', savedCandidateId)
    setPitches(prev => ({ ...prev, [key]: { ...prev[key], candidateSaved: true } }))
  }

  return (
    <div className="intake-result">

      {/* Header */}
      <div className="intake-header">
        <div className="intake-header-left">
          <div className="intake-candidate-name">
            {c?.name || 'Unknown Candidate'}
            {saved && savedCandidateId && (
              <span className="intake-saved-links">
                <Link to={`/network/${savedCandidateId}`} className="intake-saved-link">View</Link>
                <Link to={`/network/${savedCandidateId}/edit`} className="intake-saved-link">Edit</Link>
              </span>
            )}
          </div>
          {(c?.current_title || c?.current_company) && (
            <div className="intake-candidate-meta">
              {[c.current_title, c.current_company].filter(Boolean).join(' · ')}
            </div>
          )}
          <div className="intake-role-line">{rankings.length} roles compared</div>
        </div>
        <button className="btn-ghost btn-sm" onClick={onClear} title="Dismiss">✕ Clear</button>
      </div>

      {/* Overall next action */}
      {result.overall_next_action && (
        <div className="intake-section">
          <p className="intake-eyebrow">Overall Next Action</p>
          <p className="intake-pitch">{result.overall_next_action}</p>
        </div>
      )}

      {/* Stack-ranked role cards */}
      <div className="multiscreen-rankings">
        {rankings.map((r, i) => {
          const variant = r.match_score >= 8 ? 'green' : r.match_score >= 5 ? 'amber' : 'red'
          const recClass = REC_CLASS[r.recommendation] ?? ''
          const recLabel = REC_LABEL[r.recommendation] ?? r.recommendation
          return (
            <div key={i} className="multiscreen-rank-card">
              <div className="multiscreen-rank-header">
                <span className="multiscreen-rank-number">#{r.rank}</span>
                <div className="multiscreen-rank-role">
                  <span className="multiscreen-role-title">{r.role_title}</span>
                  <span className="multiscreen-company">{r.company}</span>
                </div>
                <div className="multiscreen-rank-scores">
                  <span className={`fit-badge fit-badge--${variant}`}>
                    {r.match_score}<span className="fit-badge-denom">/10</span>
                  </span>
                  <span className={`screener-rec-badge ${recClass}`}>{recLabel}</span>
                </div>
              </div>

              {(r.score_label || r.salary_range) && (
                <div className="multiscreen-meta-row">
                  {r.score_label && <p className="multiscreen-score-label">{r.score_label}</p>}
                  {r.salary_range && <span className="multiscreen-salary">{r.salary_range}</span>}
                </div>
              )}

              {r.why && <p className="multiscreen-why">{r.why}</p>}

              <div className="multiscreen-two-col">
                {r.strengths?.length > 0 && (
                  <div className="screener-block">
                    <p className="screener-block-label">Strengths</p>
                    <ul className="screener-list screener-list--strengths">
                      {r.strengths.map((s, j) => <li key={j}>{s}</li>)}
                    </ul>
                  </div>
                )}
                {r.gaps?.length > 0 && (
                  <div className="screener-block">
                    <p className="screener-block-label">Gaps</p>
                    <ul className="screener-list screener-list--concerns">
                      {r.gaps.map((g, j) => <li key={j}>{g}</li>)}
                    </ul>
                  </div>
                )}
              </div>

              {r.next_action && (
                <div className="multiscreen-next-action">
                  <span className="screener-block-label">Next</span>
                  <span>{r.next_action}</span>
                </div>
              )}

              {/* Per-card pitch */}
              {pitches[r.rank]?.phase === 'done' ? (
                <div className="multiscreen-pitch-section">
                  <div className="multiscreen-pitch-block">
                    <div className="multiscreen-pitch-block-header">
                      <p className="intake-eyebrow">Email Pitch</p>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn-ghost btn-sm"
                          onClick={() => {
                            navigator.clipboard.writeText(pitches[r.rank].email)
                            setPitches(prev => ({ ...prev, [r.rank]: { ...prev[r.rank], emailCopied: true } }))
                            setTimeout(() => setPitches(prev => ({ ...prev, [r.rank]: { ...prev[r.rank], emailCopied: false } })), 2000)
                          }}
                        >
                          {pitches[r.rank].emailCopied ? 'Copied ✓' : 'Copy'}
                        </button>
                        {saved && savedCandidateId && !pitches[r.rank].emailSaved && (
                          <button
                            className="btn-ghost btn-sm"
                            onClick={async () => {
                              await handleSavePitchToQueue(r, pitches[r.rank].email)
                              setPitches(prev => ({ ...prev, [r.rank]: { ...prev[r.rank], emailSaved: true } }))
                            }}
                          >
                            Save to Queue
                          </button>
                        )}
                        {pitches[r.rank].emailSaved && <span className="saved-label">Saved ✓</span>}
                        {saved && savedCandidateId && !pitches[r.rank].candidateSaved && (
                          <button
                            className="btn-ghost btn-sm"
                            onClick={() => handleSavePitchToCandidate(r, r.rank)}
                          >
                            Save to Candidate
                          </button>
                        )}
                        {pitches[r.rank].candidateSaved && <span className="saved-label">Saved to Candidate ✓</span>}
                      </div>
                    </div>
                    <textarea
                      className="sub-draft-textarea"
                      rows={5}
                      value={pitches[r.rank].email}
                      onChange={e => setPitches(prev => ({ ...prev, [r.rank]: { ...prev[r.rank], email: e.target.value } }))}
                    />
                  </div>
                  <div className="multiscreen-pitch-block">
                    <div className="multiscreen-pitch-block-header">
                      <p className="intake-eyebrow">Bullets</p>
                      <button
                        className="btn-ghost btn-sm"
                        onClick={() => {
                          navigator.clipboard.writeText(pitches[r.rank].bullets)
                          setPitches(prev => ({ ...prev, [r.rank]: { ...prev[r.rank], bulletsCopied: true } }))
                          setTimeout(() => setPitches(prev => ({ ...prev, [r.rank]: { ...prev[r.rank], bulletsCopied: false } })), 2000)
                        }}
                      >
                        {pitches[r.rank].bulletsCopied ? 'Copied ✓' : 'Copy'}
                      </button>
                    </div>
                    <textarea
                      className="sub-draft-textarea"
                      rows={4}
                      value={pitches[r.rank].bullets}
                      onChange={e => setPitches(prev => ({ ...prev, [r.rank]: { ...prev[r.rank], bullets: e.target.value } }))}
                    />
                  </div>
                  <button className="btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => handleGeneratePitch(r)}>
                    Regenerate
                  </button>
                </div>
              ) : pitches[r.rank]?.phase === 'generating' ? (
                <div className="modal-generating" style={{ marginTop: 10 }}>
                  <div className="spinner spinner--sm" /> Drafting pitches…
                </div>
              ) : (
                <div style={{ marginTop: 10 }}>
                  <button className="btn-ghost btn-sm" onClick={() => handleGeneratePitch(r)}>
                    {pitches[r.rank]?.phase === 'error' ? 'Retry Pitch' : 'Generate Pitch'}
                  </button>
                </div>
              )}

            </div>
          )
        })}
      </div>

      {/* Auto-save status */}
      <div className="intake-actions">
        <div className="intake-actions-right">
          {saving && <span className="intake-save-status">Saving…</span>}
          {saveError && (
            <>
              <span className="intake-save-error">{saveError}</span>
              <button className="btn-ghost btn-sm" onClick={handleSaveAll}>Try again</button>
            </>
          )}
          {saved && <span className="saved-label">Saved ✓</span>}
        </div>
      </div>

    </div>
  )
}

// ── WrenCommand ───────────────────────────────────────────

export default function WrenCommand() {
  const { recruiter }       = useRecruiter()
  const { fireResponse }    = useAgent()
  const fileInputRef        = useRef(null)
  const textareaRef         = useRef(null)
  const fileHashRef         = useRef(new Map()) // key: "name:size" → { type, label, content }
  const autoSubmitRef       = useRef(false)
  const [chips, setChips]   = useState([])
  const [freeform, setFreeform] = useState('')
  const [loading, setLoading]       = useState(false)
  const [result, setResult]         = useState(null)
  const [multiResult, setMultiResult] = useState(null)
  const [error, setError]           = useState(null)

  // Auto-parse: when a single resume chip finishes classifying and no result is showing, auto-submit
  useEffect(() => {
    if (!autoSubmitRef.current) return
    if (chips.some(c => c.loading)) return
    if (result || multiResult) { autoSubmitRef.current = false; return }
    if (chips.length === 1 && chips[0]?.type === 'resume' && !freeform.trim()) {
      autoSubmitRef.current = false
      handleSubmit()
    }
  // handleSubmit is defined below — safe because useEffect fires after render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chips, result, multiResult])

  // ── Classify a text block and resolve a loading chip ──

  async function classifyAndUpdateChip(text, id) {
    try {
      const { system, messages, maxTokens } = buildClassifyMessages(text)
      const raw = await generateText({ system, messages, maxTokens })
      const parsed = parseJson(raw) || { type: 'notes', label: 'Document' }
      setChips(prev => prev.map(c =>
        c.id === id ? { ...c, type: parsed.type, label: parsed.label, loading: false } : c
      ))
      return { type: parsed.type, label: parsed.label }
    } catch {
      setChips(prev => prev.map(c =>
        c.id === id ? { ...c, type: 'notes', label: 'Document', loading: false } : c
      ))
      return { type: 'notes', label: 'Document' }
    }
  }

  // ── Fetch a URL server-side and chip the result ──────

  async function fetchUrlAsChip(url) {
    const id = Date.now()
    const shortLabel = url.includes('docs.google.com') ? 'Google Doc' : new URL(url).hostname
    setChips(prev => [...prev, { id, type: null, label: `Fetching ${shortLabel}…`, content: null, loading: true }])
    setFreeform('')
    try {
      const res = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok || !data.text) {
        setChips(prev => prev.filter(c => c.id !== id))
        setError(data.error ?? 'Could not fetch that URL.')
        return
      }
      setChips(prev => prev.map(c => c.id === id ? { ...c, content: data.text } : c))
      await classifyAndUpdateChip(data.text, id)
    } catch {
      setChips(prev => prev.filter(c => c.id !== id))
      setError('Could not fetch that URL. Check the address and try again.')
    }
  }

  // ── Paste: auto-detect large blocks or URLs ───────────

  function handlePaste(e) {
    const text = e.clipboardData.getData('text').trim()

    // If it looks like a URL, fetch it
    if (/^https?:\/\/\S+$/.test(text)) {
      e.preventDefault()
      fetchUrlAsChip(text)
      return
    }

    if (text.length <= 300) return // let normal paste proceed

    e.preventDefault()
    const id = Date.now()
    setChips(prev => [...prev, { id, type: null, label: 'Reading…', content: text, loading: true }])
    setFreeform('')
    classifyAndUpdateChip(text, id)
  }

  // ── File attach ───────────────────────────────────────

  async function handleFiles(fileList) {
    const files = Array.from(fileList)
    for (const file of files) {
      const fileKey = `${file.name}:${file.size}`

      // Dedup: reuse cached parse result for same file
      if (fileHashRef.current.has(fileKey)) {
        const cached = fileHashRef.current.get(fileKey)
        const id = Date.now() + Math.random()
        setChips(prev => [...prev, { id, ...cached, loading: false }])
        if (cached.type === 'resume' && !result && !multiResult) autoSubmitRef.current = true
        continue
      }

      const id = Date.now() + Math.random()
      setChips(prev => [...prev, { id, type: null, label: 'Reading…', content: null, loading: true }])

      try {
        let text = ''

        if (file.type === 'application/pdf') {
          if (file.size > 10 * 1024 * 1024) {
            const hintId = Date.now() + Math.random()
            setChips(prev => [
              ...prev.map(c => c.id === id
                ? { ...c, loading: false, error: true, label: `${file.name} — too large` }
                : c
              ),
              { id: hintId, type: 'hint', label: 'Paste the text instead', loading: false },
            ])
            continue
          }
          const base64 = await fileToBase64(file)
          const raw = await generateText({ messages: buildCvPdfMessages(base64), maxTokens: 4096 })
          const parsed = parseJson(raw)
          text = parsed?.cv_text || raw
        } else {
          const buffer = await file.arrayBuffer()
          const res = await mammoth.extractRawText({ arrayBuffer: buffer })
          text = res.value
        }

        if (text.trim()) {
          setChips(prev => prev.map(c => c.id === id ? { ...c, content: text } : c))
          const { type, label } = await classifyAndUpdateChip(text, id)
          fileHashRef.current.set(fileKey, { type, label, content: text })
          if (type === 'resume' && !result && !multiResult) autoSubmitRef.current = true
        } else {
          setChips(prev => prev.filter(c => c.id !== id))
        }
      } catch (err) {
        console.error('File extraction failed:', err)
        const hintId = Date.now() + Math.random()
        setChips(prev => [
          ...prev.map(c => c.id === id
            ? { ...c, loading: false, error: true, label: `${file.name} — couldn't read` }
            : c
          ),
          { id: hintId, type: 'hint', label: 'Paste the text instead', loading: false },
        ])
      }
    }
  }

  // ── Remove a chip ─────────────────────────────────────

  function removeChip(id) {
    setChips(prev => prev.filter(c => c.id !== id))
  }

  // ── Submit ────────────────────────────────────────────

  const anyLoading   = chips.some(c => c.loading)
  const hasContent   = chips.length > 0 || freeform.trim().length > 0
  const canSubmit    = hasContent && !anyLoading && !loading

  // Detect multi-screen mode: 1 resume chip + 2 or more JD chips
  const resumeChips  = chips.filter(c => !c.loading && c.type === 'resume')
  const jdChips      = chips.filter(c => !c.loading && c.type === 'jd')
  const isMultiScreen = resumeChips.length === 1 && jdChips.length >= 2

  async function handleSubmit() {
    if (!canSubmit) return

    // If freeform is just a URL and no chips, fetch it first
    const trimmed = freeform.trim()
    if (chips.length === 0 && /^https?:\/\/\S+$/.test(trimmed)) {
      fetchUrlAsChip(trimmed)
      return
    }

    setLoading(true)
    setResult(null)
    setMultiResult(null)
    setError(null)

    try {
      const docBlocks = chips
        .map(c => `<document type="${c.type}" name="${c.label}">\n${c.content}\n</document>`)
        .join('\n\n')

      const fullInput = [docBlocks, freeform.trim()].filter(Boolean).join('\n\n')

      if (isMultiScreen) {
        const { system, messages, maxTokens } = buildMultiScreenMessages(fullInput)
        const text = await generateText({ system, messages, maxTokens })
        const parsed = parseJson(text)
        if (!parsed) throw new Error('No valid JSON in response')
        setMultiResult(parsed)
      } else {
        const { data: existingRoles } = recruiter?.id
          ? await supabase
              .from('roles')
              .select('id, title, clients(name)')
              .eq('recruiter_id', recruiter.id)
              .eq('status', 'open')
          : { data: [] }
        const { system, messages, maxTokens } = buildIntakeMessages(fullInput, existingRoles ?? [])
        const text = await generateText({ system, messages, maxTokens })
        const parsed = parseJson(text)
        if (!parsed) throw new Error('No valid JSON in response')
        setResult(parsed)
      }
    } catch (err) {
      console.error('Intake failed:', err)
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmit()
  }

  // ── Render ────────────────────────────────────────────

  return (
    <section className="wren-command">
      <p className="wren-command-label">Wren</p>

      {/* Chip row */}
      {chips.length > 0 && (
        <div className="wren-chips">
          {chips.map(chip => (
            chip.type === 'hint'
              ? <button
                  key={chip.id}
                  className="wren-chip wren-chip--hint"
                  onClick={() => { removeChip(chip.id); textareaRef.current?.focus() }}
                >
                  <span className="wren-chip-icon">↓</span>
                  <span className="wren-chip-label">{chip.label}</span>
                </button>
              : <span
                  key={chip.id}
                  className={`wren-chip ${chip.loading ? 'wren-chip--loading' : chip.error ? 'wren-chip--error' : `wren-chip--${chip.type}`}`}
                >
                  {!chip.loading && <span className="wren-chip-icon">{chip.error ? '⚠' : (CHIP_ICONS[chip.type] ?? '📄')}</span>}
                  <span className="wren-chip-label">{chip.label}</span>
                  <button
                    className="wren-chip-remove"
                    onClick={() => removeChip(chip.id)}
                    title="Remove"
                    aria-label="Remove document"
                  >
                    ×
                  </button>
                </span>
          ))}
        </div>
      )}

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        className="wren-command-textarea"
        placeholder="Drop anything. Resume, JD, call notes, a question. Wren handles it."
        value={freeform}
        onChange={e => setFreeform(e.target.value)}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        rows={4}
        disabled={loading}
      />

      {/* Footer */}
      <div className="wren-command-footer">
        <div className="wren-command-footer-left">
          <button
            className="wren-attach-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Attach PDF or DOCX"
            disabled={loading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx"
            multiple
            style={{ display: 'none' }}
            onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
          />
          {anyLoading && <span className="wren-command-hint">Classifying…</span>}
          {isMultiScreen && !anyLoading && (
            <span className="wren-multiscreen-badge">
              Multi-screen · {jdChips.length} roles
            </span>
          )}
        </div>
        <div className="wren-command-footer-right">
          <span className="wren-command-hint">⌘↵ to submit</span>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {loading
              ? 'Wren is thinking…'
              : isMultiScreen
                ? `Compare ${jdChips.length} roles →`
                : 'Let Wren fly →'
            }
          </button>
        </div>
      </div>

      {loading && (
        <div className="modal-generating" style={{ marginTop: 16 }}>
          <div className="spinner spinner--sm" />
          Wren is processing…
        </div>
      )}

      {error && <p className="wren-command-error">{error}</p>}
      {result && (
        <IntakeResult
          result={result}
          recruiter={recruiter}
          jdChips={jdChips}
          onClear={() => setResult(null)}
          onSaved={({ candidateId, candidate, role, screening }) => {
            if (candidateId) {
              fireResponse('candidate_created', {
                candidate: {
                  name:            candidate?.name,
                  current_title:   candidate?.current_title,
                  current_company: candidate?.current_company,
                },
                role:     role ? { title: role.title, company: role.company } : null,
                screening: screening ? { score: screening.score } : null,
              })
            } else {
              fireResponse('role_saved', {
                candidate_present: false,
                role: role ? { title: role.title, company: role.company } : null,
              })
            }
          }}
        />
      )}
      {multiResult && (
        <MultiScreenResult
          result={multiResult}
          recruiter={recruiter}
          jdChips={jdChips}
          onClear={() => setMultiResult(null)}
          onSaved={({ candidate, rankings }) => {
            fireResponse('candidate_created', {
              candidate: {
                name:            candidate?.name,
                current_title:   candidate?.current_title,
                current_company: candidate?.current_company,
              },
              multi_screen: true,
              roles_compared: rankings?.length ?? 0,
              top_role: rankings?.[0] ? { title: rankings[0].role_title, score: rankings[0].match_score } : null,
            })
          }}
        />
      )}
    </section>
  )
}
