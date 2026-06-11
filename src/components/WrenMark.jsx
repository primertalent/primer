export default function WrenMark({ state = 'idle', tone = 'ink', size = '26px' }) {
  const cls = [
    'wren',
    tone,
    state !== 'idle' && 'thinking',
    state === 'working' && 'busy',
  ].filter(Boolean).join(' ')

  return (
    <span className={cls} style={{ width: size }}>
      <img className="wb" src="/assets/wren-body.png" alt="" />
      <img className="ww" src="/assets/wren-wing.png" alt="Wren" />
    </span>
  )
}
