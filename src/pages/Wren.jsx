import { useEffect, useRef, useState } from 'react'
import AppLayout from '../components/AppLayout'
import ScreenResult from '../components/wren/ScreenResult'
import SubmittalDraft from '../components/wren/SubmittalDraft'
import { useRecruiter } from '../hooks/useRecruiter'
import { supabase } from '../lib/supabase'

export default function Wren() {
  const { recruiter } = useRecruiter()
  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
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
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [messages, streamingMsg])

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

  async function sendMessage() {
    if (!inputText.trim() || streaming) return
    const text = inputText.trim()
    setInputText('')
    setStreaming(true)

    const optimisticUser = {
      id: crypto.randomUUID(),
      role: 'user',
      content: { type: 'text', text },
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
        body: JSON.stringify({ conversation_id: convId, message: text }),
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
    const text = msg.content?.text || ''
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
            return <SubmittalDraft key={i} data={r.data} isLatest={isLatest} />
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
                  return <SubmittalDraft key={i} data={r.data} isLatest={true} />
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

        <div className="wren-input-bar">
          <textarea
            ref={inputRef}
            className="wren-input"
            placeholder="Screen a resume, draft a submittal, write outreach, find a network fit…"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming}
            rows={1}
          />
          <button
            className="btn-primary wren-send"
            onClick={sendMessage}
            disabled={!inputText.trim() || streaming}
          >
            Send
          </button>
        </div>
      </div>
    </AppLayout>
  )
}
