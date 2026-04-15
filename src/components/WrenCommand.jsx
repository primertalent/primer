import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import mammoth from 'mammoth'
import { supabase } from '../lib/supabase'
import { useRecruiter } from '../hooks/useRecruiter'
import { generateText } from '../lib/ai'
import { buildIntakeMessages, buildClassifyMessages } from '../lib/prompts/intake'
import { buildMultiScreenMessages } from '../lib/prompts/multiScreen'
import { buildCvPdfMessages } from '../lib/prompts/cvExtraction'

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

function IntakeResult({ result, recruiter, onClear }) {
  const [saving, setSaving]            = useState(false)
  const [saved, setSaved]              = useState(false)
  const [savedCandidateId, setSavedId] = useState(null)
  const [saveError, setSaveError]      = useState(null)
  const [copied, setCopied]            = useState(null)

  const { candidate: c, role: r, screening: s, pitch, call_log, next_actions, freeform_answer } = result

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

      if (r?.title && r?.company && candidateId) {
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

        let roleId
        const { data: existingRole } = await supabase
          .from('roles').select('id')
          .eq('recruiter_id', recruiter.id).eq('client_id', clientId).ilike('title', r.title)
          .maybeSingle()

        if (existingRole) {
          roleId = existingRole.id
        } else {
          const { data, error } = await supabase
            .from('roles')
            .insert({
              recruiter_id: recruiter.id,
              client_id: clientId,
              title: r.title,
              status: 'open',
              process_steps: ['Sourced', 'Screen', 'Hiring Manager', 'Final Round', 'Offer', 'Placed'],
            })
            .select('id').single()
          if (error) throw error
          roleId = data.id
        }

        const fitScore = s?.score ? Math.min(100, Math.round(s.score * 10)) : null
        const { error: pipeErr } = await supabase.from('pipeline').upsert(
          {
            recruiter_id: recruiter.id,
            candidate_id: candidateId,
            role_id: roleId,
            current_stage: 'Sourced',
            status: 'active',
            ...(fitScore != null && { fit_score: fitScore }),
            ...(s?.reasoning    && { fit_score_rationale: s.reasoning }),
          },
          { onConflict: 'candidate_id,role_id' }
        )
        if (pipeErr) throw pipeErr
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
    } catch (err) {
      console.error('Save All failed:', err)
      setSaveError('Save failed. Check console.')
    } finally {
      setSaving(false)
    }
  }

  const hasSignals     = c?.signals && Object.entries(c.signals).some(([k, v]) => k !== 'red_flags' ? !!v : v?.length > 0)
  const hasBullets     = pitch?.bullets?.length > 0
  const hasNextActions = next_actions?.length > 0

  return (
    <div className="intake-result">
      <div className="intake-header">
        <div className="intake-header-left">
          <div className="intake-candidate-name">
            {c?.name || 'Unknown Candidate'}
            {saved && savedCandidateId && (
              <span className="intake-saved-links">
                <Link to={`/candidates/${savedCandidateId}`} className="intake-saved-link">View</Link>
                <Link to={`/candidates/${savedCandidateId}/edit`} className="intake-saved-link">Edit</Link>
              </span>
            )}
          </div>
          {(c?.current_title || c?.current_company) && (
            <div className="intake-candidate-meta">
              {[c.current_title, c.current_company].filter(Boolean).join(' · ')}
            </div>
          )}
          {r?.title && (
            <div className="intake-role-line">
              {r.title}{r.company ? ` @ ${r.company}` : ''}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <button className="btn-ghost btn-sm" onClick={onClear} title="Dismiss result">✕ Clear</button>
          {s?.score > 0 && (
            <div className="intake-score">
              <span className="intake-score-value">{s.score}<span className="intake-score-denom">/10</span></span>
              {s.score_label && <span className="intake-score-label">{s.score_label}</span>}
            </div>
          )}
        </div>
      </div>

      {hasSignals && (
        <div className="intake-section">
          <p className="intake-eyebrow">Call Signals</p>
          <div className="intake-signals">
            <SignalRow label="Motivation" value={c.signals.motivation} />
            <SignalRow label="Relocation" value={c.signals.relocation} />
            <SignalRow label="Comp"       value={c.signals.comp_expectations} />
            <SignalRow label="Timeline"   value={c.signals.timeline} />
            {(c.signals.red_flags || []).map((flag, i) => (
              <SignalRow key={i} label="Flag" value={flag} />
            ))}
          </div>
        </div>
      )}

      {pitch?.one_liner && (
        <div className="intake-section">
          <p className="intake-eyebrow">Pitch</p>
          <p className="intake-pitch">{pitch.one_liner}</p>
        </div>
      )}

      {hasBullets && (
        <div className="intake-section">
          <p className="intake-eyebrow">Submission Bullets</p>
          <ul className="intake-bullets">
            {pitch.bullets.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>
      )}

      {hasNextActions && (
        <div className="intake-section">
          <p className="intake-eyebrow">Next Actions</p>
          <ul className="intake-next-actions">
            {next_actions.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}

      {freeform_answer && (
        <div className="intake-section">
          <p className="intake-eyebrow">Answer</p>
          <p className="intake-freeform">{freeform_answer}</p>
        </div>
      )}

      <div className="intake-actions">
        {pitch?.one_liner && (
          <button className="btn-ghost" onClick={() => handleCopy('pitch')}>
            {copied === 'pitch' ? 'Copied ✓' : 'Copy Pitch'}
          </button>
        )}
        {hasBullets && (
          <button className="btn-ghost" onClick={() => handleCopy('bullets')}>
            {copied === 'bullets' ? 'Copied ✓' : 'Copy Bullets'}
          </button>
        )}
        <div className="intake-actions-right">
          {saveError && <span className="intake-save-error">Couldn't save. Try again.</span>}
          {saved ? (
            <span className="saved-label">Saved ✓</span>
          ) : (
            <button
              className="btn-primary"
              onClick={handleSaveAll}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save All'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── MultiScreenResult ─────────────────────────────────────

const REC_LABEL = { advance: 'Advance', hold: 'Hold', pass: 'Pass' }
const REC_CLASS = { advance: 'screener-rec--advance', hold: 'screener-rec--hold', pass: 'screener-rec--pass' }

function MultiScreenResult({ result, recruiter, onClear }) {
  const [saving, setSaving]            = useState(false)
  const [saved, setSaved]              = useState(false)
  const [savedCandidateId, setSavedId] = useState(null)
  const [saveError, setSaveError]      = useState(null)

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
          const { data, error } = await supabase
            .from('roles')
            .insert({
              recruiter_id: recruiter.id,
              client_id: clientId,
              title: ranking.role_title,
              status: 'open',
              process_steps: ['Sourced', 'Screen', 'Hiring Manager', 'Final Round', 'Offer', 'Placed'],
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
    } catch (err) {
      console.error('MultiScreen Save All failed:', err)
      setSaveError('Couldn\'t save. Try again.')
    } finally {
      setSaving(false)
    }
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
                <Link to={`/candidates/${savedCandidateId}`} className="intake-saved-link">View</Link>
                <Link to={`/candidates/${savedCandidateId}/edit`} className="intake-saved-link">Edit</Link>
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

              {r.score_label && (
                <p className="multiscreen-score-label">{r.score_label}</p>
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
            </div>
          )
        })}
      </div>

      {/* Save */}
      <div className="intake-actions">
        <div className="intake-actions-right">
          {saveError && <span className="intake-save-error">{saveError}</span>}
          {saved ? (
            <span className="saved-label">Saved ✓</span>
          ) : (
            <button className="btn-primary" onClick={handleSaveAll} disabled={saving}>
              {saving ? 'Saving…' : `Save All (${rankings.length} roles)`}
            </button>
          )}
        </div>
      </div>

    </div>
  )
}

// ── WrenCommand ───────────────────────────────────────────

export default function WrenCommand() {
  const { recruiter }       = useRecruiter()
  const fileInputRef        = useRef(null)
  const [chips, setChips]   = useState([])
  const [freeform, setFreeform] = useState('')
  const [loading, setLoading]       = useState(false)
  const [result, setResult]         = useState(null)
  const [multiResult, setMultiResult] = useState(null)
  const [error, setError]           = useState(null)

  // ── Classify a text block and resolve a loading chip ──

  async function classifyAndUpdateChip(text, id) {
    try {
      const { system, messages, maxTokens } = buildClassifyMessages(text)
      const raw = await generateText({ system, messages, maxTokens })
      const parsed = parseJson(raw) || { type: 'notes', label: 'Document' }
      setChips(prev => prev.map(c =>
        c.id === id ? { ...c, type: parsed.type, label: parsed.label, loading: false } : c
      ))
    } catch {
      // Fallback: keep chip as 'notes'
      setChips(prev => prev.map(c =>
        c.id === id ? { ...c, type: 'notes', label: 'Document', loading: false } : c
      ))
    }
  }

  // ── Paste: auto-detect large blocks ──────────────────

  function handlePaste(e) {
    const text = e.clipboardData.getData('text')
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
      const id = Date.now() + Math.random()
      setChips(prev => [...prev, { id, type: null, label: 'Reading…', content: null, loading: true }])

      try {
        let text = ''

        if (file.type === 'application/pdf') {
          const base64 = await fileToBase64(file)
          const raw = await generateText({ messages: buildCvPdfMessages(base64), maxTokens: 4096 })
          const parsed = parseJson(raw)
          text = parsed?.cv_text || raw
        } else {
          // .docx
          const buffer = await file.arrayBuffer()
          const res = await mammoth.extractRawText({ arrayBuffer: buffer })
          text = res.value
        }

        if (text.trim()) {
          // Update chip content first, then classify
          setChips(prev => prev.map(c => c.id === id ? { ...c, content: text } : c))
          await classifyAndUpdateChip(text, id)
        } else {
          setChips(prev => prev.filter(c => c.id !== id))
        }
      } catch (err) {
        console.error('File extraction failed:', err)
        setChips(prev => prev.filter(c => c.id !== id))
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
        const { system, messages, maxTokens } = buildIntakeMessages(fullInput)
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
            <span
              key={chip.id}
              className={`wren-chip ${chip.loading ? 'wren-chip--loading' : `wren-chip--${chip.type}`}`}
            >
              {!chip.loading && <span className="wren-chip-icon">{CHIP_ICONS[chip.type] ?? '📄'}</span>}
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
      {result && <IntakeResult result={result} recruiter={recruiter} onClear={() => setResult(null)} />}
      {multiResult && <MultiScreenResult result={multiResult} recruiter={recruiter} onClear={() => setMultiResult(null)} />}
    </section>
  )
}
