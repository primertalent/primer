import { useEffect, useRef, useState } from 'react'
import AppLayout from '../components/AppLayout'
import ScreenResult from '../components/wren/ScreenResult'
import SubmittalDraft from '../components/wren/SubmittalDraft'
import IngestResult from '../components/wren/IngestResult'
import GoogleConnectCard from '../components/wren/GoogleConnectCard'
import Chip from '../components/Chip'
import { useRecruiter } from '../hooks/useRecruiter'
import { supabase } from '../lib/supabase'

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

export default function Wren() {
  const { recruiter } = useRecruiter()
  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [pendingPaste, setPendingPaste] = useState(null) // { text, label }
  const [streaming, setStreaming] = useState(false)
  const [streamingMsg, setStreamingMsg] = useState(null)
  const threadRef = useRef(null)
  const inputRef = useRef(null)
  const loadedRef = useRef(false)

  useEffect(() => {
    if (!recruiter?.id || loadedRef.current) return
    loadedRef.current = true
    loadMostRecentConversation()
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
      setMessages(prev => [...prev, {
        id: 'google-connected-' + Date.now(),
        role: 'assistant',
        content: { type: 'text', text: 'Gmail connected. Approved submittals can now be sent directly from your inbox.' },
        created_at: new Date().toISOString(),
        _local: true,
      }])
    }
  }, [])

  async function loadMostRecentConversation() {
    const { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!conv) return

    setConversationId(conv.id)

    const { data: msgs } = await supabase
      .from('conversation_messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true })

    if (msgs) setMessages(msgs)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
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

  async function sendMessage() {
    if (!canSend) return

    let messageText = inputText.trim()
    if (pendingPaste) {
      const docBlock = `<document type="paste" name="${pendingPaste.label}">\n${pendingPaste.text}\n</document>`
      messageText = messageText ? `${docBlock}\n\n${messageText}` : docBlock
    }

    // Display text strips the raw document content — the thread stays readable
    const displayText = [
      pendingPaste ? `[${pendingPaste.label}]` : '',
      inputText.trim(),
    ].filter(Boolean).join('  ')

    setPendingPaste(null)
    setInputText('')
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
    let convId = conversationId

    try {
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
          } else if (evtType === 'text') {
            accText += payload.text
            setStreamingMsg({ text: accText, renders: accRenders })
          } else if (evtType === 'tool_result') {
            accRenders = [...accRenders, { tool: payload.tool, data: payload.data }]
            setStreamingMsg({ text: accText, renders: accRenders })
          } else if (evtType === 'done') {
            const finalMsg = {
              id: payload.message_id || crypto.randomUUID(),
              role: 'assistant',
              content: { type: 'message', text: accText, renders: accRenders },
              created_at: new Date().toISOString(),
            }
            setMessages(prev => [...prev, finalMsg])
            setStreamingMsg(null)
          } else if (evtType === 'error') {
            throw new Error(payload.message || 'Stream error')
          }
        }
      }
    } catch (err) {
      console.error('[Wren]', err)
      setStreamingMsg(prev =>
        prev ? { ...prev, error: err.message } : null
      )
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
    const isUser = msg.role === 'user'
    // Strip document blocks from user messages — raw content goes to server, thread stays readable
    const rawText = msg.content?.text || ''
    const text = isUser ? stripDocumentBlocks(rawText) : rawText
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
              gmailConnected={!!recruiter?.gmail_access_token}
              onSent={(to, ts) => {
                setMessages(prev => [...prev, {
                  id: 'send-confirm-' + Date.now(),
                  role: 'assistant',
                  content: { type: 'text', text: `Sent to ${to} at ${ts}. Logged to your interactions.` },
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

  const totalDrafts = countTotalDrafts()
  const draftSeenRef = useRef(0)
  draftSeenRef.current = 0

  return (
    <AppLayout fullBleed>
      <div className="wren-shell">
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
                <div className="wren-msg__text">{streamingMsg.text}</div>
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
                <div className="wren-thinking">
                  <span /><span /><span />
                </div>
              )}
            </div>
          )}
        </div>

        {recruiter && !recruiter.gmail_access_token && (
          <div className="wren-gmail-hint">
            <span>Gmail not connected</span>
            <button className="wren-gmail-hint__connect" onClick={initiateGoogleOAuth}>
              Connect
            </button>
          </div>
        )}
        <div className="wren-input-bar">
          {pendingPaste && (
            <div className="wren-chips">
              <Chip
                type="notes"
                label={pendingPaste.label}
                onRemove={() => setPendingPaste(null)}
              />
            </div>
          )}
          <textarea
            ref={inputRef}
            className="wren-input"
            placeholder="Screen a resume, draft a submittal, write outreach, find a network fit — or paste anything."
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={streaming}
            rows={1}
          />
          <button
            className="btn-primary wren-send"
            onClick={sendMessage}
            disabled={!canSend}
          >
            Send
          </button>
        </div>
      </div>
    </AppLayout>
  )
}
