import { useEffect, useRef, useState } from 'react'
import { marked } from 'marked'
import AppLayout from '../components/AppLayout'
import { useRecruiter } from '../hooks/useRecruiter'
import { supabase } from '../lib/supabase'

function renderMarkdown(text) {
  const result = marked.parse(text ?? '', { breaks: true, gfm: true })
  return { __html: typeof result === 'string' ? result : '' }
}

function ThreeDots() {
  return (
    <div className="wren-dots">
      <span /><span /><span />
    </div>
  )
}

export default function Wren() {
  const { recruiter } = useRecruiter()
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    if (!recruiter) return
    loadConversations()
  }, [recruiter?.id])

  useEffect(() => {
    if (!activeId) return
    loadMessages(activeId)
  }, [activeId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function loadConversations() {
    const { data } = await supabase
      .from('conversations')
      .select('id, title, updated_at')
      .order('updated_at', { ascending: false })
    setConversations(data ?? [])
  }

  async function loadMessages(convId) {
    const { data } = await supabase
      .from('conversation_messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
  }

  async function createConversation(title) {
    const { data } = await supabase
      .from('conversations')
      .insert({ recruiter_id: recruiter.id, title: title.slice(0, 80) })
      .select()
      .single()
    return data
  }

  async function startNew() {
    setActiveId(null)
    setMessages([])
  }

  async function selectConversation(id) {
    if (id === activeId) return
    setMessages([])
    setActiveId(id)
  }

  async function send() {
    const text = input.trim()
    if (!text || loading || !recruiter) return

    setInput('')
    setLoading(true)

    let convId = activeId

    if (!convId) {
      const conv = await createConversation(text)
      if (!conv) { setLoading(false); return }
      convId = conv.id
      setActiveId(convId)
      setConversations(prev => [conv, ...prev])
    }

    // Persist user message
    const { data: userMsg } = await supabase
      .from('conversation_messages')
      .insert({ conversation_id: convId, recruiter_id: recruiter.id, role: 'user', content: { text } })
      .select()
      .single()

    if (userMsg) setMessages(prev => [...prev, userMsg])

    // Call endpoint
    let reply = ''
    try {
      const res = await fetch('/api/wren', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversationId: convId }),
      })
      const json = await res.json()
      reply = json.reply ?? ''
    } catch {
      reply = 'Something went wrong. Try again.'
    }

    // Persist assistant message
    const { data: asstMsg } = await supabase
      .from('conversation_messages')
      .insert({ conversation_id: convId, recruiter_id: recruiter.id, role: 'assistant', content: { text: reply } })
      .select()
      .single()

    if (asstMsg) setMessages(prev => [...prev, asstMsg])

    // Touch conversation updated_at + refresh title on first message
    const { data: updatedConv } = await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', convId)
      .select('id, title, updated_at')
      .single()

    if (updatedConv) {
      setConversations(prev => {
        const exists = prev.some(c => c.id === convId)
        const next = exists
          ? prev.map(c => c.id === convId ? updatedConv : c)
          : [updatedConv, ...prev]
        return next.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      })
    }

    setLoading(false)
  }

  function handleKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      send()
    }
  }

  const isEmpty = messages.length === 0 && !loading

  return (
    <AppLayout fullBleed>
      <div className="wren-shell">

        {/* Sidebar */}
        <aside className="wren-sidebar">
          <button className="wren-new-btn" onClick={startNew}>
            New conversation
          </button>
          <div className="wren-conv-list">
            {conversations.length === 0 && (
              <p className="wren-conv-empty">No conversations yet.</p>
            )}
            {conversations.map(conv => (
              <button
                key={conv.id}
                className={`wren-conv-item${conv.id === activeId ? ' wren-conv-item--active' : ''}`}
                onClick={() => selectConversation(conv.id)}
              >
                <span className="wren-conv-title">{conv.title || 'Untitled'}</span>
                <span className="wren-conv-time">{formatRelative(conv.updated_at)}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Chat area */}
        <div className="wren-chat">
          <div className="wren-stream">
            {isEmpty && (
              <div className="wren-empty">
                <p className="wren-empty-heading">Wren</p>
                <p className="wren-empty-sub">What are you working on?</p>
              </div>
            )}

            {messages.map(msg => (
              <div
                key={msg.id}
                className={`wren-bubble-row wren-bubble-row--${msg.role}`}
              >
                {msg.role === 'user' ? (
                  <div className="wren-bubble wren-bubble--user">
                    {msg.content?.text}
                  </div>
                ) : (
                  <div
                    className="wren-bubble wren-bubble--agent"
                    dangerouslySetInnerHTML={renderMarkdown(msg.content?.text)}
                  />
                )}
              </div>
            ))}

            {loading && (
              <div className="wren-bubble-row wren-bubble-row--assistant">
                <div className="wren-bubble wren-bubble--agent">
                  <ThreeDots />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Composer */}
          <div className="wren-composer">
            <textarea
              ref={textareaRef}
              className="wren-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Wren…"
              rows={1}
              disabled={loading}
            />
            <button
              className="wren-send-btn"
              onClick={send}
              disabled={!input.trim() || loading}
            >
              Send
            </button>
          </div>
          <p className="wren-hint">⌘ Enter to send</p>
        </div>

      </div>
    </AppLayout>
  )
}

function formatRelative(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
