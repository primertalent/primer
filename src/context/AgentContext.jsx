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
  const [status, setStatus] = useState('idle')
  const [response, setResponse] = useState(null)
  const registryRef = useRef(new Map())

  const think = useCallback(() => {
    setStatus('thinking')
    setResponse(null)
  }, [])

  const speak = useCallback((message, suggestions = []) => {
    setResponse({ message, suggestions })
    setStatus('speaking')
  }, [])

  const fail = useCallback((message = 'Saved. Wren hit a branch generating next steps.') => {
    setResponse({ message, suggestions: [] })
    setStatus('error')
  }, [])

  const clear = useCallback(() => {
    setStatus('idle')
    setResponse(null)
  }, [])

  // Fire agentResponse prompt in background. Save must already be committed before calling.
  const fireResponse = useCallback((action, context) => {
    think()
    const { system, messages, maxTokens } = buildAgentResponseMessages(action, context)
    generateText({ system, messages, maxTokens })
      .then(raw => {
        const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()
        const parsed = parseJson(cleaned)
        if (parsed?.message) {
          speak(parsed.message, parsed.suggestions ?? [])
        } else {
          fail()
        }
      })
      .catch(() => fail())
  }, [think, speak, fail])

  // Register a page-level handler for a suggestion action.
  // Pages call registerAction on mount and unregisterAction on unmount.
  const registerAction = useCallback((actionId, handler) => {
    registryRef.current.set(actionId, handler)
  }, [])

  const unregisterAction = useCallback((actionId) => {
    registryRef.current.delete(actionId)
  }, [])

  // Dispatch a suggestion action. Checks page registry first, then falls back to navigation.
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
        if (cid) navigate(`/candidates/${cid}`, { state: { autoScreen: rid } })
        break
      case 'draft_submission':
        if (cid) navigate(`/candidates/${cid}`)
        break
      case 'add_fee':
        if (rid) navigate(`/roles/${rid}/edit`)
        break
      case 'log_debrief':
        if (cid) navigate(`/candidates/${cid}`, { state: { openDebrief: true } })
        break
      case 'log_interaction':
        if (cid) navigate(`/candidates/${cid}`, { state: { openLog: true } })
        break
      case 'set_expected_comp':
        if (cid) navigate(`/candidates/${cid}`, { state: { openCompFor: pid } })
        break
      case 'prep_for_interview':
        if (cid) navigate(`/candidates/${cid}`)
        break
      case 'draft_outreach':
        if (cid) navigate(`/candidates/${cid}`)
        break
      case 'build_search_strings':
        if (rid) navigate(`/roles/${rid}`)
        break
      case 'find_network_fits':
        navigate(rid ? `/candidates?role=${rid}` : '/candidates')
        break
      case 'queue_follow_up':
        if (cid) navigate(`/candidates/${cid}`)
        break
      case 'draft_urgency_note':
        if (cid) navigate(`/candidates/${cid}`)
        break
      default:
        break
    }
  }, [navigate])

  return (
    <AgentContext.Provider value={{
      status, response,
      think, speak, fail, clear,
      fireResponse, dispatch,
      registerAction, unregisterAction,
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
