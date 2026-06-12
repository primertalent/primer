import { useEffect, useMemo, useRef, useState } from 'react'
import AppLayout from '../components/AppLayout'
import ScreenResult from '../components/wren/ScreenResult'
import SubmittalDraft from '../components/wren/SubmittalDraft'
import IngestResult from '../components/wren/IngestResult'
import GoogleConnectCard from '../components/wren/GoogleConnectCard'
import QuickOpen from '../components/wren/QuickOpen'
import { WrenMark } from '../components/WrenMark'
import Chip from '../components/Chip'
import { useRecruiter } from '../hooks/useRecruiter'
import { supabase } from '../lib/supabase'

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

function initiateGoogleOAuth() {
  const params = new URLSearchParams({
    client_id:     import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri:  `${window.location.origin}/auth/google/callback`,
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/gmail.send',
    access_type:   'offline',
    prompt:        'consent',
  })
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

// Strip <document type="paste">...</document> blocks for display — raw content
// is sent to the server but never shown in the thread.
function stripDocumentBlocks(text) {
  return (text || '').replace(/<document[^>]*>[\s\S]*?<\/document>/g, '').trim()
}

// Dash sanitizer — explicit \u escapes to guarantee correct matching regardless
// of how the bundler handles the source file encoding.
// U+2012 figure dash, U+2013 en dash, U+2014 em dash, U+2015 horizontal bar.
function sanitizeDashes(text) {
  if (!text) return text
  return text
    .replace(/ -- /g, ', ')
    .replace(/(\S)[‒–—―](\S)/g, '$1-$2')
    .replace(/ [‒–—―] /g, ', ')
    .replace(/[‒–—―]/g, ' - ')
}

// Client-side mirror of the server-side sanitizeRenderData in api/wren.js.
// Applied to tool_result payloads before storing in accRenders so streaming
// and in-memory renders are clean without waiting for a page reload.
function sanitizeRenderData(data) {
  if (!data || typeof data !== 'object') return data
  if (Array.isArray(data)) return data.map(item => typeof item === 'string' ? sanitizeDashes(item) : sanitizeRenderData(item))
  const out = {}
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string') out[k] = sanitizeDashes(v)
    else if (Array.isArray(v)) out[k] = v.map(item => typeof item === 'string' ? sanitizeDashes(item) : sanitizeRenderData(item))
    else if (v && typeof v === 'object') out[k] = sanitizeRenderData(v)
    else out[k] = v
  }
  return out
}

// Remove stray markdown syntax from Wren's conversational text. Conservative:
// only strips paired markers and leading header tokens — never reflows content,
// so a lone ** in pasted comp notes degrades to literal ** rather than mangling.
// Also sanitizes dashes so historical rows (pre-fix) clean up at render time.
function stripMarkdown(text) {
  return sanitizeDashes(
    (text || '')
      .replace(/\*\*(.*?)\*\*/gs, '$1')  // **bold** → bold (paired only)
      .replace(/__(.*?)__/gs, '$1')       // __bold__ → bold (paired only)
      .replace(/^#{1,6} /gm, '')          // ## Header → Header
      .replace(/`([^`\n]+)`/g, '$1')      // `code` → code (single-line only)
  )
}

// Stage weights for pipeline value — keyed by current_stage.toLowerCase().trim().
// Zero-weight stages are explicit so only truly unrecognized strings trigger the unknown counter.
const STAGE_WEIGHTS = {
  sourced: 0, outreach: 0, applied: 0, shortlisted: 0, shortlist: 0,
  screen: 0, screening: 0, 'phone screen': 0, phone_screen: 0,
  submitted: 0.30, submitting: 0.30, interviewing: 0.30, interview: 0.30,
  'first interview': 0.30, '1st interview': 0.30, 'phone interview': 0.30,
  'second interview': 0.40, '2nd interview': 0.40,
  'final round': 0.55, final_round: 0.55, 'final interview': 0.55,
  'late stage': 0.55, late_stage: 0.55,
  verbal: 0.70, 'verbal offer': 0.70,
  offer: 0.80, 'offer extended': 0.80, offered: 0.80,
  accepted: 0.95, 'offer accepted': 0.95,
}

function fmtCurrency(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 10_000)    return `$${Math.round(v / 1_000)}k`
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}k`
  return `$${Math.round(v)}`
}

function DeskTicker({ ticker }) {
  let nextLabel = '—'
  let nextOverdue = false
  if (ticker.nextMove) {
    const d = new Date(ticker.nextMove)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    nextOverdue = d < today
    nextLabel = nextOverdue
      ? 'overdue'
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="wren-ticker">
      <div className="wren-ticker__item">
        <span className="wren-ticker__label">WEIGHTED</span>
        <span className="wren-ticker__value">
          {ticker.weighted > 0 ? fmtCurrency(ticker.weighted) : '—'}
          {ticker.unknownCount > 0 && (
            <sup title={`${ticker.unknownCount} deal${ticker.unknownCount > 1 ? 's' : ''} not weighted, stage not recognized`}>*</sup>
          )}
        </span>
      </div>
      <div className="wren-ticker__item">
        <span className="wren-ticker__label">AT RISK</span>
        <span
          className="wren-ticker__value"
          style={ticker.atRisk > 0 ? { color: 'var(--accent)' } : undefined}
        >
          {ticker.atRisk > 0 ? fmtCurrency(ticker.atRisk) : '—'}
        </span>
      </div>
      <div className="wren-ticker__item">
        <span className="wren-ticker__label">NEXT MOVE</span>
        <span
          className="wren-ticker__value"
          style={nextOverdue ? { color: 'var(--accent)' } : undefined}
        >
          {nextLabel}
        </span>
      </div>
      {ticker.unknownCount > 0 && (
        <span className="wren-ticker__note">
          *{ticker.unknownCount} deal{ticker.unknownCount > 1 ? 's' : ''} unweighted, unknown stage
        </span>
      )}
    </div>
  )
}

export default function Wren() {
  const { recruiter } = useRecruiter()
  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [pendingPaste, setPendingPaste] = useState(null) // { text, label }
  const [streaming, setStreaming] = useState(false)
  const [streamingMsg, setStreamingMsg] = useState(null)
  const [gmailTokenRevoked, setGmailTokenRevoked] = useState(false)
  const [convList, setConvList] = useState([])
  const [railOpen, setRailOpen] = useState(true)
  const [quickOpenOpen, setQuickOpenOpen] = useState(false)
  const [ticker, setTicker] = useState(null)
  const [extracting, setExtracting] = useState(false)
  const threadRef = useRef(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const loadedRef = useRef(false)
  const latestConvIdRef = useRef(null)

  useEffect(() => {
    if (!recruiter?.id || loadedRef.current) return
    loadedRef.current = true
    loadMostRecentConversation()
    loadTickerData()
  }, [recruiter?.id])

  useEffect(() => {
    if (!threadRef.current) return
    const el = threadRef.current
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight })
  }, [messages, streamingMsg])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('google_connected') === '1') {
      window.history.replaceState({}, '', '/wren')
      setGmailTokenRevoked(false)
      setMessages(prev => [...prev, {
        id: 'google-connected-' + Date.now(),
        role: 'assistant',
        content: { type: 'text', text: 'Gmail connected. Approved submittals can now be sent directly from your inbox.' },
        created_at: new Date().toISOString(),
        _local: true,
      }])
    }
  }, [])

  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setQuickOpenOpen(open => !open)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  async function loadMostRecentConversation() {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    // Find today's conversation (by created_at, local-midnight boundary)
    let { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // No today conversation — create one so the brief has a home
    if (!conv) {
      const { data: created } = await supabase
        .from('conversations')
        .insert({ recruiter_id: recruiter.id })
        .select('id')
        .single()
      conv = created
    }

    if (!conv) return

    setConversationId(conv.id)
    latestConvIdRef.current = conv.id

    const { data: msgs } = await supabase
      .from('conversation_messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true })

    if (msgs) setMessages(msgs)
    loadConversationList()

    // Server decides whether to compose — client always delegates
    composeMorningBrief(conv.id)
  }

  async function composeMorningBrief(convId) {
    setStreaming(true)
    setStreamingMsg({ text: '', renders: [] })

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const resp = await fetch('/api/compose-brief', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ conversation_id: convId }),
      })

      if (!resp.ok) return

      const result = await resp.json()

      if (result.message_id) {
        // Brief freshly composed and persisted — reload messages to surface it
        const { data: msgs } = await supabase
          .from('conversation_messages')
          .select('id, role, content, created_at')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true })
        if (msgs) setMessages(msgs)
      }
      // already_composed: brief already in loaded messages, no reload needed
      // no_actions: empty desk, thread stays empty ("Ready. What do you need?")
    } catch (err) {
      console.error('[brief]', err.message)
    } finally {
      setStreaming(false)
      setStreamingMsg(null)
    }
  }

  async function loadConversationList() {
    const { data } = await supabase
      .from('conversations')
      .select('id, updated_at')
      .order('updated_at', { ascending: false })
      .limit(60)
    if (data) setConvList(data)
  }

  async function loadTickerData() {
    if (!recruiter?.id) return

    const [{ data: pipes }, { data: riskActions }] = await Promise.all([
      supabase
        .from('pipelines')
        .select(`
          id, current_stage, expected_comp, expected_comp_high, next_action_due_at,
          roles ( placement_fee_pct, placement_fee_flat, target_comp_min, target_comp_max, status )
        `)
        .eq('recruiter_id', recruiter.id)
        .not('current_stage', 'in', '(placed,lost)'),
      supabase
        .from('actions')
        .select('linked_entity_id')
        .eq('recruiter_id', recruiter.id)
        .eq('linked_entity_type', 'pipeline')
        .in('action_type', ['risk_flag', 'follow_up_overdue'])
        .in('urgency', ['now', 'today'])
        .is('dismissed_at', null)
        .is('acted_on_at', null),
    ])

    const atRiskIds = new Set((riskActions || []).map(a => a.linked_entity_id))
    let weighted = 0
    let atRisk = 0
    let nextMove = null
    let unknownCount = 0

    for (const p of (pipes || [])) {
      if (p.roles?.status === 'closed') continue

      const stageKey = (p.current_stage || '').toLowerCase().trim()
      const weight = STAGE_WEIGHTS[stageKey]

      if (weight === undefined) {
        unknownCount++
        console.warn('[ticker] unrecognized stage:', JSON.stringify(p.current_stage), 'pipeline:', p.id)
        continue
      }
      if (weight === 0) continue

      const comp = p.expected_comp
        ? (p.expected_comp_high
            ? (Number(p.expected_comp) + Number(p.expected_comp_high)) / 2
            : Number(p.expected_comp))
        : (p.roles?.target_comp_min && p.roles?.target_comp_max
            ? (Number(p.roles.target_comp_min) + Number(p.roles.target_comp_max)) / 2
            : null)

      const feePct  = p.roles?.placement_fee_pct ?? recruiter.default_placement_fee_pct
      const feeFlat = p.roles?.placement_fee_flat

      let feeValue = null
      if (comp && feePct)        feeValue = comp * Number(feePct)
      else if (feeFlat != null)  feeValue = Number(feeFlat)

      if (feeValue != null && feeValue > 0) {
        const dealValue = feeValue * weight
        weighted += dealValue
        if (atRiskIds.has(p.id)) atRisk += dealValue
      }

      const isOfferOrAccepted = ['offer', 'offer extended', 'offered', 'verbal', 'verbal offer', 'accepted', 'offer accepted'].includes(stageKey)
      if (isOfferOrAccepted && p.next_action_due_at) {
        if (!nextMove || new Date(p.next_action_due_at) < new Date(nextMove)) {
          nextMove = p.next_action_due_at
        }
      }
    }

    setTicker({ weighted, atRisk, nextMove, unknownCount })
  }

  async function switchToDay(convIds) {
    const results = await Promise.all(
      convIds.map(id =>
        supabase
          .from('conversation_messages')
          .select('id, role, content, created_at')
          .eq('conversation_id', id)
          .order('created_at', { ascending: true })
      )
    )
    const allMsgs = results.flatMap(r => r.data || [])
    allMsgs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    setMessages(allMsgs)
    setConversationId(convIds[0])
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  async function handleFileAttach(file) {
    if (!file) return
    setPendingPaste(null)
    setExtracting(true)
    try {
      const base64 = await fileToBase64(file)
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')
      const resp = await fetch('/api/extract-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ filename: file.name, content_base64: base64 }),
      })
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${resp.status}`)
      }
      const { text } = await resp.json()
      setPendingPaste({ text, label: file.name })
    } catch (err) {
      console.error('[attach]', err)
      setMessages(prev => [...prev, {
        id: 'attach-error-' + Date.now(),
        role: 'assistant',
        content: { type: 'text', text: err.message || 'Could not extract the file — try again or paste the resume text directly.' },
        created_at: new Date().toISOString(),
        _local: true,
      }])
    } finally {
      setExtracting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handlePaste(e) {
    const text = e.clipboardData?.getData('text')?.trim() || ''
    // Short text or URL: native paste
    if (!text || text.length <= 300 || /^https?:\/\/\S+$/.test(text)) return
    e.preventDefault()
    setPendingPaste({ text, label: 'Pasted document' })
  }

  const canSend = (inputText.trim() || pendingPaste) && !streaming

  async function sendMessage(directMsg = null) {
    if (directMsg != null ? streaming : !canSend) return

    let messageText
    let displayText
    if (directMsg != null) {
      messageText = directMsg.trim()
      displayText = messageText
      if (!messageText) return
    } else {
      messageText = inputText.trim()
      if (pendingPaste) {
        const docBlock = `<document type="paste" name="${pendingPaste.label}">\n${pendingPaste.text}\n</document>`
        messageText = messageText ? `${docBlock}\n\n${messageText}` : docBlock
      }
      displayText = [
        pendingPaste ? `[${pendingPaste.label}]` : '',
        inputText.trim(),
      ].filter(Boolean).join('  ')
      setPendingPaste(null)
      setInputText('')
      if (inputRef.current) inputRef.current.style.height = 'auto'
    }

    try {
      if (latestConvIdRef.current && conversationId !== latestConvIdRef.current) {
        const targetId = latestConvIdRef.current
        setConversationId(targetId)
        const { data: histMsgs } = await supabase
          .from('conversation_messages')
          .select('id, role, content, created_at')
          .eq('conversation_id', targetId)
          .order('created_at', { ascending: true })
        if (histMsgs) setMessages(histMsgs)
      }

      setStreaming(true)

      const optimisticUser = {
        id: crypto.randomUUID(),
        role: 'user',
        content: { type: 'text', text: displayText },
        created_at: new Date().toISOString(),
        _optimistic: true,
      }
      setMessages(prev => [...prev, optimisticUser])
      setStreamingMsg({ text: '', renders: [] })

      let accText = ''
      let accRenders = []
      let convId = latestConvIdRef.current || conversationId
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')

      const resp = await fetch('/api/wren', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ conversation_id: convId, message: messageText }),
      })

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${resp.status}`)
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })

        let sep
        while ((sep = buf.indexOf('\n\n')) !== -1) {
          const block = buf.slice(0, sep)
          buf = buf.slice(sep + 2)

          let evtType = 'message'
          let evtData = ''
          for (const line of block.split('\n')) {
            if (line.startsWith('event:')) evtType = line.slice(6).trim()
            else if (line.startsWith('data:')) evtData = line.slice(5).trim()
          }
          if (!evtData) continue

          let payload
          try { payload = JSON.parse(evtData) } catch { continue }

          if (evtType === 'conversation') {
            convId = payload.conversation_id
            setConversationId(convId)
            latestConvIdRef.current = convId
          } else if (evtType === 'text') {
            accText += payload.text
            setStreamingMsg({ text: sanitizeDashes(accText), renders: accRenders })
          } else if (evtType === 'tool_result') {
            accRenders = [...accRenders, { tool: payload.tool, data: sanitizeRenderData(payload.data) }]
            setStreamingMsg({ text: sanitizeDashes(accText), renders: accRenders })
          } else if (evtType === 'done') {
            const finalMsg = {
              id: payload.message_id || crypto.randomUUID(),
              role: 'assistant',
              content: { type: 'message', text: accText, renders: accRenders },
              created_at: new Date().toISOString(),
            }
            setMessages(prev => [...prev, finalMsg])
            setStreamingMsg(null)
            loadConversationList()
          } else if (evtType === 'error') {
            throw new Error(payload.message || 'Stream error')
          }
        }
      }
    } catch (err) {
      console.error('[Wren]', err)
      setMessages(prev => [
        ...prev,
        {
          id: 'send-error-' + Date.now(),
          role: 'assistant',
          content: { type: 'text', text: 'Something broke sending that — try again.' },
          created_at: new Date().toISOString(),
          _local: true,
        },
      ])
    } finally {
      setStreaming(false)
      setStreamingMsg(null)  // clear thinking dots on any close — abrupt or clean
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  // Count total draft renders across all messages + streaming, so SubmittalDraft
  // knows which draft is the latest and should be expanded.
  function countTotalDrafts() {
    let n = 0
    for (const msg of messages) {
      for (const r of msg.content?.renders || []) {
        if (r.tool === 'draft_submittal') n++
      }
    }
    for (const r of streamingMsg?.renders || []) {
      if (r.tool === 'draft_submittal') n++
    }
    return n
  }

  function renderMessage(msg, draftSeenRef, totalDrafts) {
    if (msg.content?.type === 'turn_steps') return null
    const isUser = msg.role === 'user'
    // Strip document blocks from user messages — raw content goes to server, thread stays readable
    const rawText = msg.content?.text || ''
    const text = isUser ? stripDocumentBlocks(rawText) : stripMarkdown(rawText)
    const renders = msg.content?.renders || msg.renders || []

    return (
      <div key={msg.id} className={`wren-msg${isUser ? ' wren-msg--user' : ' wren-msg--wren'}`}>
        {!isUser && <div className="wren-msg__label">WREN</div>}
        {text && <div className="wren-msg__text">{text}</div>}
        {renders.map((r, i) => {
          if (r.tool === 'screen_candidate') {
            return <ScreenResult key={i} data={r.data} />
          }
          if (r.tool === 'draft_submittal') {
            draftSeenRef.current++
            const isLatest = draftSeenRef.current === totalDrafts
            return <SubmittalDraft
              key={i}
              data={r.data}
              isLatest={isLatest}
              gmailConnected={!!recruiter?.gmail_access_token && !gmailTokenRevoked}
              onSent={(to, ts) => {
                setMessages(prev => [...prev, {
                  id: 'send-confirm-' + Date.now(),
                  role: 'assistant',
                  content: { type: 'text', text: `Sent to ${to} at ${ts}. Logged to your interactions.` },
                  created_at: new Date().toISOString(),
                  _local: true,
                }])
              }}
              onTokenRevoked={() => {
                setGmailTokenRevoked(true)
                setMessages(prev => [...prev, {
                  id: 'token-revoked-' + Date.now(),
                  role: 'assistant',
                  content: { type: 'text', text: 'Google access was revoked. Reconnect below to resume sending.' },
                  created_at: new Date().toISOString(),
                  _local: true,
                }])
              }}
            />
          }
          if (r.tool === 'ingest_input' || r.tool === 'enrich_from_notes') {
            return <IngestResult key={i} data={r.data} />
          }
          if (r.tool === 'connect_google') {
            return <GoogleConnectCard key={i} />
          }
          return null
        })}
      </div>
    )
  }

  const dayGroups = useMemo(() => {
    const byDay = new Map()
    for (const conv of convList) {
      const key = new Date(conv.updated_at).toDateString()
      if (!byDay.has(key)) byDay.set(key, [])
      byDay.get(key).push(conv.id)
    }
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    return [...byDay.entries()].map(([key, ids]) => {
      let label
      if (key === today.toDateString()) label = 'Today'
      else if (key === yesterday.toDateString()) label = 'Yesterday'
      else label = new Date(key).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      return { key, label, convIds: [...ids].reverse() }
    })
  }, [convList])

  const totalDrafts = countTotalDrafts()
  const draftSeenRef = useRef(0)
  draftSeenRef.current = 0

  return (
    <AppLayout fullBleed thinking={streaming || extracting}>
      <div className="wren-shell">
        <aside className={`wren-rail${railOpen ? '' : ' wren-rail--closed'}`}>
          <div className="wren-rail__header">
            <span>HISTORY</span>
            <button
              className="wren-rail__toggle"
              onClick={() => setRailOpen(r => !r)}
              aria-label={railOpen ? 'Close history' : 'Open history'}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d={railOpen ? 'M7 2L4 5l3 3' : 'M3 2l3 3-3 3'} />
              </svg>
            </button>
          </div>
          <nav className="wren-rail__days">
            {dayGroups.map(({ key, label, convIds }) => {
              const isActive = convIds.includes(conversationId)
              return (
                <button
                  key={key}
                  className={`wren-rail__day${isActive ? ' wren-rail__day--active' : ''}`}
                  onClick={() => switchToDay(convIds)}
                >
                  {label}
                </button>
              )
            })}
          </nav>
        </aside>
        <div className="wren-col">
          {ticker && <DeskTicker ticker={ticker} />}
          <div className="wren-thread" ref={threadRef}>
            {messages.length === 0 && !streamingMsg && (
              <div className="wren-empty">
                <span>Ready. What do you need?</span>
              </div>
            )}
            {messages.map(msg => renderMessage(msg, draftSeenRef, totalDrafts))}
            {streamingMsg && (
              <div className="wren-msg wren-msg--wren wren-msg--streaming">
                <div className="wren-msg__label">WREN</div>
                {streamingMsg.text && (
                  <div className="wren-msg__text">{stripMarkdown(streamingMsg.text)}</div>
                )}
                {streamingMsg.renders.map((r, i) => {
                  if (r.tool === 'screen_candidate') {
                    return <ScreenResult key={i} data={r.data} />
                  }
                  if (r.tool === 'draft_submittal') {
                    draftSeenRef.current++
                    return <SubmittalDraft key={i} data={r.data} isLatest={true} gmailConnected={false} />
                  }
                  if (r.tool === 'ingest_input' || r.tool === 'enrich_from_notes') {
                    return <IngestResult key={i} data={r.data} />
                  }
                  if (r.tool === 'connect_google') {
                    return <GoogleConnectCard key={i} />
                  }
                  return null
                })}
                {streamingMsg.error && (
                  <div className="wren-msg__error">{streamingMsg.error}</div>
                )}
                {!streamingMsg.text && !streamingMsg.error && (
                  <WrenMark state="thinking" size={26} />
                )}
              </div>
            )}
          </div>

          {recruiter && (!recruiter.gmail_access_token || gmailTokenRevoked) && (
            <div className="wren-gmail-hint">
              <span>Gmail not connected</span>
              <button className="wren-gmail-hint__connect" onClick={initiateGoogleOAuth}>
                Connect
              </button>
            </div>
          )}
          <div
            className="wren-input-bar"
            onDrop={e => { e.preventDefault(); handleFileAttach(e.dataTransfer.files?.[0]) }}
            onDragOver={e => e.preventDefault()}
          >
            {(pendingPaste || extracting) && (
              <div className="wren-chips">
                {extracting
                  ? <Chip label="Extracting…" loading />
                  : <Chip type="notes" label={pendingPaste.label} onRemove={() => setPendingPaste(null)} />
                }
              </div>
            )}
            <textarea
              ref={inputRef}
              className="wren-input"
              placeholder="Screen a resume, draft a submittal, write outreach, or paste anything."
              value={inputText}
              onChange={e => {
                setInputText(e.target.value)
                const el = e.target
                el.style.height = 'auto'
                el.style.height = `${el.scrollHeight}px`
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              disabled={streaming}
              rows={2}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="wren-attach-input"
              onChange={e => handleFileAttach(e.target.files?.[0])}
            />
            <button
              className="wren-attach-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={extracting || streaming}
              title="Attach CV (PDF or Word)"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13.5 6.5L6.5 13.5a4 4 0 01-5.657-5.657L8 0.686" />
                <path d="M11.5 4.5L5 11a2 2 0 002.828 2.828L14 7.657" />
              </svg>
            </button>
            <button
              className="btn-primary wren-send"
              onClick={() => sendMessage()}
              disabled={!canSend}
            >
              Send
            </button>
          </div>
        </div>
      </div>
      {quickOpenOpen && (
        <QuickOpen
          onSelect={prompt => {
            setQuickOpenOpen(false)
            sendMessage(prompt)
          }}
          onClose={() => setQuickOpenOpen(false)}
        />
      )}
    </AppLayout>
  )
}
