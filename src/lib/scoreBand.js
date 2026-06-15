export function bandFromScore(score) {
  if (typeof score !== 'number' || !isFinite(score) || score < 1 || score > 10) return 'hold'
  if (score >= 8) return 'advance'
  if (score >= 4) return 'hold'
  return 'pass'
}
