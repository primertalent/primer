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

const URGENCY_RANK = { now: 0, today: 1, this_week: 2 }

const URGENCY_SECTIONS = [
  { key: 'now',       label: 'NOW' },
  { key: 'today',     label: 'TODAY' },
  { key: 'this_week', label: 'THIS WEEK' },
]

export default function Desk() {
  const { recruiter } = useRecruiter()
  const { ephemeralCards, dismissEphemeralCard, dispatch } = useAgent()
  const [persistedActions, setPersistedActions] = useState([])
  const [hasAnyHistory, setHasAnyHistory] = useState(false)
  const [loading, setLoading] = useState(true)
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [panel, setPanel] = useState({ type: null, id: null })
  const loadedRef = useRef(false)

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
        setHasAnyHistory(true)
        setPersistedActions(prev => [
          { ...payload.new, entityName: null, entitySubtitle: null, candidateId: null, pipelineId: null, roleId: null },
          ...prev,
        ])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [recruiter?.id])

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
        ? supabase.from('pipeline').select('id, candidates(id, first_name, last_name), roles(title, clients(name))').in('id', pipelineIds)
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

    </AppLayout>
  )
}
