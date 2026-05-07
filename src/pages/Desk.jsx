import { useEffect, useRef, useState } from 'react'
import AppLayout from '../components/AppLayout'
import ActionCard from '../components/ActionCard'
import SidePanel from '../components/SidePanel'
import WrenCommand from '../components/WrenCommand'
import CandidateCard from './CandidateCard'
import RoleDetail from './RoleDetail'
import { useRecruiter } from '../hooks/useRecruiter'
import { useAgent } from '../context/AgentContext'
import { supabase } from '../lib/supabase'
import { generateText } from '../lib/ai'
import { buildSubmittalFromMeetNotesMessages } from '../lib/prompts/submissionDraft'

const URGENCY_RANK = { now: 0, today: 1, this_week: 2 }

const URGENCY_SECTIONS = [
  { key: 'now',       label: 'NOW' },
  { key: 'today',     label: 'TODAY' },
  { key: 'this_week', label: 'THIS WEEK' },
]

export default function Desk() {
  const { recruiter } = useRecruiter()
  const { ephemeralCards, dismissEphemeralCard, dispatch, registerAction, unregisterAction } = useAgent()
  const [persistedActions, setPersistedActions] = useState([])
  const [hasAnyHistory, setHasAnyHistory] = useState(false)
  const [loading, setLoading] = useState(true)
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [panel, setPanel] = useState({ type: null, id: null })
  const [toast, setToast] = useState(null)
  const loadedRef = useRef(false)

  // Auto-dismiss toast after 3s
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  function openPanel(action) {
    if (action.candidateId) setPanel({ type: 'candidate', id: action.candidateId })
    else if (action.roleId)  setPanel({ type: 'role',      id: action.roleId })
  }

  function closePanel() { setPanel({ type: null, id: null }) }

  useEffect(() => {
    if (!recruiter?.id || loadedRef.current) return
    loadedRef.current = true
    loadActions()
  }, [recruiter?.id])

  // Realtime: surface new agent loop actions without a page reload
  useEffect(() => {
    if (!recruiter?.id) return
    const channel = supabase
      .channel(`actions:${recruiter.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'actions',
        filter: `recruiter_id=eq.${recruiter.id}`,
      }, payload => {
        const n = payload.new
        let candidateId = null, pipelineId = null, roleId = null
        if      (n.linked_entity_type === 'candidate') candidateId = n.linked_entity_id ?? null
        else if (n.linked_entity_type === 'pipeline')  pipelineId  = n.linked_entity_id ?? null
        else if (n.linked_entity_type === 'role')      roleId      = n.linked_entity_id ?? null
        setHasAnyHistory(true)
        setPersistedActions(prev => [
          { ...n, entityName: null, entitySubtitle: null, candidateId, pipelineId, roleId },
          ...prev,
        ])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [recruiter?.id])

  // ── Submittal draft handlers ──────────────────────────────────────────────
  // Registered here so they have access to recruiter, setPersistedActions, setToast.
  // Re-registers when recruiter loads (first mount may fire before recruiter is ready).
  useEffect(() => {
    if (!recruiter?.id) return

    registerAction('trigger_submittal_draft', async (ctx) => {
      // Idempotency: reuse an existing generated/in_review draft for this pipeline
      // created in the last 5 minutes — avoids duplicate Sonnet calls on retry.
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      try {
        // Clear any previous failure flag before starting
        setPersistedActions(prev => prev.map(a =>
          a.id === ctx.action_id ? { ...a, _generationFailed: false } : a
        ))

        const { data: existingDraft } = await supabase
          .from('drafts')
          .select('id, content')
          .eq('linked_entity_id', ctx.pipeline_id)
          .eq('linked_entity_type', 'pipeline')
          .eq('artifact_type', 'submittal')
          .in('status', ['generated', 'in_review'])
          .gte('created_at', fiveMinutesAgo)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        let generatedText = ''
        let draftId = null

        if (existingDraft) {
          generatedText = existingDraft.content?.text ?? ''
          draftId = existingDraft.id
        } else {
          // Fetch candidate + role for prompt construction
          let candidate = { first_name: ctx.candidate_name?.split(' ')[0] ?? 'Unknown', last_name: ctx.candidate_name?.split(' ').slice(1).join(' ') ?? '' }
          let role = { title: ctx.role_title ?? 'Unknown', notes: null }

          const [candRes, roleRes] = await Promise.all([
            supabase.from('candidates').select('id, first_name, last_name, current_title, current_company, location, cv_text').eq('id', ctx.candidate_id).single(),
            ctx.role_id
              ? supabase.from('roles').select('id, title, notes, target_comp_min, target_comp_max').eq('id', ctx.role_id).single()
              : Promise.resolve({ data: null, error: null }),
          ])
          if (!candRes.error && candRes.data) candidate = candRes.data
          if (!roleRes.error && roleRes.data) role = roleRes.data

          const messages = buildSubmittalFromMeetNotesMessages(candidate, role, ctx.notes_body || '', 'bullet')
          generatedText = await generateText({ messages, maxTokens: 800 })

          const { data: draft, error: draftErr } = await supabase
            .from('drafts')
            .insert({
              recruiter_id:       recruiter.id,
              linked_entity_id:   ctx.pipeline_id,
              linked_entity_type: 'pipeline',
              artifact_type:      'submittal',
              content:            { format: 'bullet', text: generatedText },
              status:             'generated',
              confidence:         'high',
              stakes:             'medium',
              autonomy_tier:      2,
            })
            .select('id')
            .single()

          if (draftErr) throw draftErr
          draftId = draft.id
        }

        // Update action row in-place: action_type → submittal_draft_ready, add draft context
        const newContext = { ...(ctx.current_context ?? {}), draft_id: draftId, draft_text: generatedText }
        await supabase.from('actions').update({
          action_type: 'submittal_draft_ready',
          context: newContext,
        }).eq('id', ctx.action_id)

        // Optimistic local state — preserves entityName, entitySubtitle, candidateId,
        // pipelineId, roleId and all other enriched fields from loadActions
        setPersistedActions(prev => prev.map(a =>
          a.id === ctx.action_id
            ? { ...a, action_type: 'submittal_draft_ready', context: newContext }
            : a
        ))
      } catch (err) {
        console.error('[Desk] trigger_submittal_draft failed:', err)
        setPersistedActions(prev => prev.map(a =>
          a.id === ctx.action_id ? { ...a, _generationFailed: true } : a
        ))
        setToast('Draft generation failed. Try again.')
      }
    })

    registerAction('approve_submittal', async (ctx) => {
      try {
        await supabase.from('drafts').update({
          status:      'approved',
          approved_at: new Date().toISOString(),
          content:     { format: 'bullet', text: ctx.content },
        }).eq('id', ctx.draft_id)
        setPersistedActions(prev => prev.filter(a => a.id !== ctx.action_id))
        await supabase.from('actions').update({ acted_on_at: new Date().toISOString() }).eq('id', ctx.action_id)
        setToast('Submittal copied. Paste into your email to send.')
      } catch (err) {
        console.warn('[Desk] approve_submittal failed:', err.message)
      }
    })

    registerAction('save_submittal_edits', async (ctx) => {
      try {
        await supabase.from('drafts').update({
          content: { format: 'bullet', text: ctx.content },
        }).eq('id', ctx.draft_id)
        // Merge edited draft_text into action context so page refresh shows the edit
        const newContext = { ...(ctx.current_context ?? {}), draft_text: ctx.content }
        await supabase.from('actions').update({ context: newContext }).eq('id', ctx.action_id)
        setPersistedActions(prev => prev.map(a =>
          a.id === ctx.action_id ? { ...a, context: newContext } : a
        ))
      } catch (err) {
        console.warn('[Desk] save_submittal_edits failed:', err.message)
      }
    })

    registerAction('discard_submittal', async (ctx) => {
      try {
        await supabase.from('drafts').update({
          status:       'discarded',
          discarded_at: new Date().toISOString(),
        }).eq('id', ctx.draft_id)
        setPersistedActions(prev => prev.filter(a => a.id !== ctx.action_id))
        await supabase.from('actions').update({ acted_on_at: new Date().toISOString() }).eq('id', ctx.action_id)
      } catch (err) {
        console.warn('[Desk] discard_submittal failed:', err.message)
      }
    })

    return () => {
      unregisterAction('trigger_submittal_draft')
      unregisterAction('approve_submittal')
      unregisterAction('save_submittal_edits')
      unregisterAction('discard_submittal')
    }
  }, [recruiter?.id, registerAction, unregisterAction])

  async function loadActions() {
    // Check if agent loop has ever run for this recruiter
    const { count } = await supabase
      .from('actions')
      .select('id', { count: 'exact', head: true })
      .eq('recruiter_id', recruiter.id)
    setHasAnyHistory((count ?? 0) > 0)

    // Fetch active (undismissed, unacted, not currently snoozed)
    const now = new Date().toISOString()
    const { data: rawActions } = await supabase
      .from('actions')
      .select('*')
      .eq('recruiter_id', recruiter.id)
      .is('dismissed_at', null)
      .is('acted_on_at', null)
      .or(`snoozed_until.is.null,snoozed_until.lt.${now}`)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!rawActions?.length) {
      setLoading(false)
      return
    }

    // Batch entity name lookups by type
    const pipelineIds = rawActions.filter(a => a.linked_entity_type === 'pipeline' && a.linked_entity_id).map(a => a.linked_entity_id)
    const candidateIds = rawActions.filter(a => a.linked_entity_type === 'candidate' && a.linked_entity_id).map(a => a.linked_entity_id)
    const roleIds = rawActions.filter(a => a.linked_entity_type === 'role' && a.linked_entity_id).map(a => a.linked_entity_id)

    const [pipeRes, candRes, roleRes] = await Promise.all([
      pipelineIds.length
        ? supabase.from('pipeline').select('id, candidates(id, first_name, last_name), roles(id, title, clients(name))').in('id', pipelineIds)
        : { data: [] },
      candidateIds.length
        ? supabase.from('candidates').select('id, first_name, last_name').in('id', candidateIds)
        : { data: [] },
      roleIds.length
        ? supabase.from('roles').select('id, title, clients(name)').in('id', roleIds)
        : { data: [] },
    ])

    const enriched = rawActions.map(a => {
      let entityName = null, entitySubtitle = null, candidateId = null, pipelineId = null, roleId = null

      if (a.linked_entity_type === 'pipeline') {
        const p = (pipeRes.data ?? []).find(r => r.id === a.linked_entity_id)
        entityName = p ? `${p.candidates?.first_name ?? ''} ${p.candidates?.last_name ?? ''}`.trim() || null : null
        entitySubtitle = p?.roles?.title ?? null
        candidateId = p?.candidates?.id ?? null
        pipelineId = a.linked_entity_id
        roleId = p?.roles?.id ?? null
      } else if (a.linked_entity_type === 'candidate') {
        const c = (candRes.data ?? []).find(r => r.id === a.linked_entity_id)
        entityName = c ? `${c.first_name} ${c.last_name}`.trim() : null
        candidateId = a.linked_entity_id
      } else if (a.linked_entity_type === 'role') {
        const r = (roleRes.data ?? []).find(r => r.id === a.linked_entity_id)
        entityName = r?.title ?? null
        entitySubtitle = r?.clients?.name ?? null
        roleId = a.linked_entity_id
      }

      return { ...a, entityName, entitySubtitle, candidateId, pipelineId, roleId }
    })

    setPersistedActions(enriched)
    setLoading(false)
  }

  async function handleDismiss(action) {
    if (action.ephemeral) {
      dismissEphemeralCard(action.id)
      return
    }
    setPersistedActions(prev => prev.filter(a => a.id !== action.id))
    await supabase.from('actions').update({ dismissed_at: new Date().toISOString() }).eq('id', action.id)
  }

  async function handleSnooze(action) {
    const until = new Date(Date.now() + 86400000).toISOString()
    setPersistedActions(prev => prev.filter(a => a.id !== action.id))
    await supabase.from('actions').update({ snoozed_until: until }).eq('id', action.id)
  }

  async function handleComplete(action) {
    setPersistedActions(prev => prev.filter(a => a.id !== action.id))
    await supabase.from('actions').update({ acted_on_at: new Date().toISOString() }).eq('id', action.id)
  }

  function handleActionsCompleted(ids) {
    setPersistedActions(prev => prev.filter(a => !ids.includes(a.id)))
  }

  const sortedPersisted = [...persistedActions].sort((a, b) =>
    (URGENCY_RANK[a.urgency] ?? 3) - (URGENCY_RANK[b.urgency] ?? 3) ||
    new Date(b.created_at) - new Date(a.created_at)
  )

  if (loading) {
    return (
      <AppLayout>
        <div className="desk-loading"><div className="spinner" /></div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="desk">

        <div className="desk-intake">
          <button
            className={`desk-intake-toggle${intakeOpen ? ' desk-intake-toggle--open' : ''}`}
            onClick={() => setIntakeOpen(v => !v)}
          >
            {intakeOpen ? '✕ Close' : '+ Drop something'}
          </button>
          {intakeOpen && (
            <div className="desk-intake-panel">
              <WrenCommand />
            </div>
          )}
        </div>

        {(ephemeralCards.length > 0 || sortedPersisted.length > 0) ? (
          <>
            {ephemeralCards.length > 0 && (
              <div className="desk-section">
                <div className="desk-cards">
                  {ephemeralCards.map(action => (
                    <ActionCard
                      key={action.id}
                      action={action}
                      onDismiss={() => handleDismiss(action)}
                      onSnooze={null}
                      onComplete={null}
                      onChipClick={(actionId, ctx) => dispatch(actionId, ctx)}
                      onCardClick={(action.candidateId || action.roleId) ? () => openPanel(action) : undefined}
                    />
                  ))}
                </div>
              </div>
            )}
            {URGENCY_SECTIONS.map(({ key, label }) => {
              const cards = sortedPersisted.filter(a => a.urgency === key)
              if (!cards.length) return null
              return (
                <div key={key} className="desk-section">
                  <div className={`desk-tray-head desk-tray-head--${key}`}>
                    <span className="desk-tray-urg">{label}</span>
                    <span className="desk-tray-count">{cards.length}</span>
                    <div className="desk-tray-rule" />
                  </div>
                  <div className="desk-cards">
                    {cards.map(action => (
                      <ActionCard
                        key={action.id}
                        action={action}
                        onDismiss={() => handleDismiss(action)}
                        onSnooze={() => handleSnooze(action)}
                        onComplete={() => handleComplete(action)}
                        onChipClick={(actionId, ctx) => dispatch(actionId, ctx)}
                        onCardClick={(action.candidateId || action.roleId) ? () => openPanel(action) : undefined}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </>
        ) : hasAnyHistory ? (
          <div className="desk-empty">
            <p className="desk-empty-headline">Caught up.</p>
            <p className="desk-empty-sub">Wren will surface new actions on the next run.</p>
          </div>
        ) : (
          <div className="desk-empty">
            <p className="desk-empty-headline">Wren is scanning your desk.</p>
            <p className="desk-empty-sub">
              The next run is in a few hours. Drop a resume or JD to get started.
            </p>
            {!intakeOpen && (
              <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => setIntakeOpen(true)}>
                Drop something
              </button>
            )}
          </div>
        )}

      </div>

      {panel.id && (
        <SidePanel onClose={closePanel}>
          {panel.type === 'candidate' && (
            <CandidateCard id={panel.id} onClose={closePanel} onActionsCompleted={handleActionsCompleted} />
          )}
          {panel.type === 'role' && (
            <RoleDetail id={panel.id} onClose={closePanel} />
          )}
        </SidePanel>
      )}

      {/* Toast — DESIGN: border-radius 0, --panel bg, --hair-2 border, --ink text,
          JetBrains Mono uppercase, no --win, no icon, no emoji */}
      {toast && <div className="desk-toast">{toast}</div>}

    </AppLayout>
  )
}
