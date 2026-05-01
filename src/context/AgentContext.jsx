import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { generateText } from '../lib/ai'
import { buildAgentResponseMessages } from '../lib/prompts/agentResponse'

const AgentContext = createContext(null)

// Which IDs each action requires. Used in dev to warn on silent no-ops.
const REQUIRED_IDS = {
  screen_against_role: ['candidate_id'],
  draft_submission:    ['candidate_id'],
  add_fee:             ['role_id'],
  log_debrief:         ['candidate_id'],
  log_interaction:     ['candidate_id'],
  set_expected_comp:   ['candidate_id'],
  prep_for_interview:  ['candidate_id'],
  prep_call:           ['candidate_id'],
  draft_outreach:      ['candidate_id'],
  build_search_strings:['role_id'],
  queue_follow_up:     ['candidate_id'],
  draft_urgency_note:  ['candidate_id'],
}

function parseJson(text) {
  try { return JSON.parse(text) } catch {}
  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
  } catch {}
  return null
}

export function AgentProvider({ children }) {
  const navigate = useNavigate()
  // Keyed by entity ID (pipelineId ?? candidateId ?? roleId ?? card.id) so that
  // a new signal for the same entity replaces the old card instead of stacking.
  const [ephemeralMap, setEphemeralMap] = useState({})
  const registryRef = useRef(new Map())

  const addEphemeralCard = useCallback((card) => {
    const entityKey = card.pipelineId ?? card.candidateId ?? card.roleId ?? card.id
    setEphemeralMap(prev => ({ ...prev, [entityKey]: card }))
  }, [])

  const dismissEphemeralCard = useCallback((cardId) => {
    setEphemeralMap(prev => {
      const entry = Object.entries(prev).find(([, c]) => c.id === cardId)
      if (!entry) return prev
      const next = { ...prev }
      delete next[entry[0]]
      return next
    })
  }, [])

  const fireResponse = useCallback((action, context) => {
    const { system, messages, maxTokens } = buildAgentResponseMessages(action, context)
    generateText({ system, messages, maxTokens })
      .then(raw => {
        const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()
        const parsed = parseJson(cleaned)
        if (parsed?.message) {
          addEphemeralCard({
            id: crypto.randomUUID(),
            ephemeral: true,
            urgency: 'now',
            action_type: action,
            why: parsed.message,
            suggested_next_step: null,
            suggestions: parsed.suggestions ?? [],
            entityName: context?.candidate?.name ?? context?.role_title ?? null,
            // Resolve nested paths first (how callers currently pass IDs),
            // then fall back to flat keys (forward-compatible).
            candidateId: context?.candidate?.id ?? context?.candidate_id ?? null,
            roleId:      context?.role?.id     ?? context?.role_id      ?? null,
            pipelineId:  context?.pipeline?.id ?? context?.pipeline_id  ?? null,
            created_at: new Date().toISOString(),
          })
        }
      })
      .catch(() => {
        // Silent — ephemeral card generation is non-critical
      })
  }, [addEphemeralCard])

  const registerAction = useCallback((actionId, handler) => {
    registryRef.current.set(actionId, handler)
  }, [])

  const unregisterAction = useCallback((actionId) => {
    registryRef.current.delete(actionId)
  }, [])

  const dispatch = useCallback((actionId, context) => {
    // Dev-mode guard: warn immediately when a chip will silently no-op due to
    // a missing required ID. This is how the suhail_goyal class of bug hides.
    if (import.meta.env.DEV) {
      const required = REQUIRED_IDS[actionId]
      if (required) {
        const missing = required.filter(key => !context?.[key])
        if (missing.length) {
          console.warn(
            `[AgentContext] dispatch('${actionId}') will no-op — missing: ${missing.join(', ')}.\n` +
            `Context received:`, context, `\n` +
            `Check the fireResponse() call site that produced this chip.`
          )
        }
      }
    }

    const handler = registryRef.current.get(actionId)
    if (handler) {
      handler(context)
      return
    }
    const cid = context?.candidate_id
    const rid = context?.role_id
    const pid = context?.pipeline_id
    switch (actionId) {
      case 'screen_against_role':
        if (cid) navigate(`/network/${cid}`, { state: { autoScreen: rid } })
        break
      case 'draft_submission':
        if (cid) navigate(`/network/${cid}`)
        break
      case 'add_fee':
        if (rid) navigate(`/roles/${rid}`)
        break
      case 'log_debrief':
        if (cid) navigate(`/network/${cid}`, { state: { openDebrief: true } })
        break
      case 'log_interaction':
        if (cid) navigate(`/network/${cid}`, { state: { openLog: true } })
        break
      case 'set_expected_comp':
        if (cid) navigate(`/network/${cid}`, { state: { openCompFor: pid } })
        break
      case 'prep_for_interview':
      case 'prep_call':
        if (cid) navigate(`/network/${cid}`)
        break
      case 'draft_outreach':
        if (cid) navigate(`/network/${cid}`)
        break
      case 'build_search_strings':
        if (rid) navigate(`/roles/${rid}`)
        break
      case 'find_network_fits':
        navigate(rid ? `/network?role=${rid}` : '/network')
        break
      case 'queue_follow_up':
      case 'draft_urgency_note':
        if (cid) navigate(`/network/${cid}`)
        break
      default:
        break
    }
  }, [navigate])

  const ephemeralCards = Object.values(ephemeralMap)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  return (
    <AgentContext.Provider value={{
      ephemeralCards,
      dismissEphemeralCard,
      fireResponse,
      dispatch,
      registerAction,
      unregisterAction,
    }}>
      {children}
    </AgentContext.Provider>
  )
}

export function useAgent() {
  const ctx = useContext(AgentContext)
  if (!ctx) throw new Error('useAgent must be used within AgentProvider')
  return ctx
}
