export function WrenMark({ size = 28, tone = 'ink', state = 'idle' }) {
  const cls = [
    'wren-mark',
    tone,
    (state === 'thinking' || state === 'working') && 'thinking',
    state === 'working' && 'busy',
    state === 'alert' && 'alert',
  ].filter(Boolean).join(' ')

  return (
    <span className={cls} style={{ width: size }}>
      <img className="wb" src="/assets/wren-body.png" alt="" />
      <img className="ww" src="/assets/wren-wing.png" alt="Wren" />
    </span>
  )
}
