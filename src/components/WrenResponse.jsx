import { useEffect, useRef, useState } from 'react'
import { useAgent } from '../context/AgentContext'

const SHORT_PHRASES = [
  "Wren's on it",
  'Hunting',
  'Sizing up the data',
  'Parsing',
  'Tracking signal',
  'Cross-checking the network',
  'Working the pipeline',
]

const LONG_PHRASES = [
  'Wren is digging in',
  'Still hunting',
  'Reading between the lines',
]

export default function WrenResponse() {
  const { status, response, clear, dispatch } = useAgent()
  const [phraseIdx, setPhraseIdx]   = useState(0)
  const [useLong, setUseLong]       = useState(false)
  const intervalRef = useRef(null)
  const longRef     = useRef(null)

  useEffect(() => {
    if (status !== 'thinking') {
      clearInterval(intervalRef.current)
      clearTimeout(longRef.current)
      setPhraseIdx(Math.floor(Math.random() * SHORT_PHRASES.length))
      setUseLong(false)
      return
    }

    setPhraseIdx(Math.floor(Math.random() * SHORT_PHRASES.length))
    setUseLong(false)

    intervalRef.current = setInterval(() => {
      setPhraseIdx(prev => prev + 1)
    }, 1800)

    longRef.current = setTimeout(() => setUseLong(true), 3200)

    return () => {
      clearInterval(intervalRef.current)
      clearTimeout(longRef.current)
    }
  }, [status])

  if (status === 'idle') return null

  const phrases = useLong ? LONG_PHRASES : SHORT_PHRASES
  const phrase  = phrases[phraseIdx % phrases.length]

  return (
    <div className={`wren-response wren-response--${status}`}>
      <div className="wren-response-inner">
        <div className="wren-response-left">
          <span className="wren-response-tag">Wren</span>

          {status === 'thinking' && (
            <span className="wren-response-thinking">
              <span className="wren-thinking-dot" />
              {phrase}
            </span>
          )}

          {(status === 'speaking' || status === 'done') && response?.message && (
            <span className="wren-response-message">{response.message}</span>
          )}

          {status === 'error' && (
            <span className="wren-response-message wren-response-message--muted">
              {response?.message ?? 'Saved. Wren hit a branch generating next steps.'}
            </span>
          )}
        </div>

        <div className="wren-response-right">
          {(status === 'speaking' || status === 'done') && response?.suggestions?.map((s, i) => (
            <button
              key={i}
              className={`wren-suggestion-chip${i > 0 ? ' wren-suggestion-chip--secondary' : ''}`}
              onClick={() => { dispatch(s.action, s.context); clear() }}
            >
              {s.label}
            </button>
          ))}
          <button className="wren-response-dismiss" onClick={clear} aria-label="Dismiss">×</button>
        </div>
      </div>
    </div>
  )
}
