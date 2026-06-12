import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function QuickOpen({ onSelect, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef(null)
  const debouncedQuery = useDebounce(query, 180)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([])
      setActiveIdx(0)
      return
    }
    const q = debouncedQuery.trim()
    let cancelled = false
    async function search() {
      const [{ data: candidates }, { data: roles }] = await Promise.all([
        supabase
          .from('candidates')
          .select('id, full_name, current_title, current_company')
          .or(`full_name.ilike.%${q}%,current_title.ilike.%${q}%,current_company.ilike.%${q}%`)
          .limit(5),
        supabase
          .from('roles')
          .select('id, title, client_name, status')
          .or(`title.ilike.%${q}%,client_name.ilike.%${q}%`)
          .limit(5),
      ])
      if (cancelled) return
      const items = [
        ...(candidates || []).map(c => ({
          id: `c-${c.id}`,
          type: 'candidate',
          label: c.full_name || '(no name)',
          sub: [c.current_title, c.current_company].filter(Boolean).join(' · '),
          prompt: `Tell me about ${c.full_name}`,
        })),
        ...(roles || []).map(r => ({
          id: `r-${r.id}`,
          type: 'role',
          label: r.title || '(no title)',
          sub: [r.client_name, r.status].filter(Boolean).join(' · '),
          prompt: `Tell me about the ${r.title}${r.client_name ? ` role at ${r.client_name}` : ''}`,
        })),
      ]
      setResults(items)
      setActiveIdx(0)
    }
    search()
    return () => { cancelled = true }
  }, [debouncedQuery])

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      onClose()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, results.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter' && results[activeIdx]) {
      e.preventDefault()
      onSelect(results[activeIdx].prompt)
    }
  }

  return (
    <div className="quick-open__backdrop" onClick={onClose}>
      <div className="quick-open" onClick={e => e.stopPropagation()}>
        <div className="quick-open__input-row">
          <input
            ref={inputRef}
            className="quick-open__input"
            placeholder="Search candidates or roles…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
          />
        </div>
        {results.length > 0 && (
          <ul className="quick-open__results">
            {results.map((item, i) => (
              <li
                key={item.id}
                className={`quick-open__result${i === activeIdx ? ' quick-open__result--active' : ''}`}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => onSelect(item.prompt)}
              >
                <span className="quick-open__result-type">{item.type === 'candidate' ? 'CANDIDATE' : 'ROLE'}</span>
                <span className="quick-open__result-label">{item.label}</span>
                {item.sub && <span className="quick-open__result-sub">{item.sub}</span>}
              </li>
            ))}
          </ul>
        )}
        {query.trim() && results.length === 0 && (
          <div className="quick-open__empty">No matches</div>
        )}
      </div>
    </div>
  )
}
