import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { generateText } from '../lib/ai'
import { buildAgentResponseMessages } from '../lib/prompts/agentResponse'

const AgentContext = createContext(null)

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
  const [ephemeralCards, setEphemeralCards] = useState([])
  const registryRef = useRef(new Map())

  const addEphemeralCard = useCallback((card) => {
    setEphemeralCards(prev => [card, ...prev])
  }, [])

  const dismissEphemeralCard = useCallback((id) => {
    setEphemeralCards(prev => prev.filter(c => c.id !== id))
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
            candidateId: context?.candidate?.id ?? null,
            roleId: context?.role_id ?? null,
            pipelineId: context?.pipeline_id ?? null,
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
