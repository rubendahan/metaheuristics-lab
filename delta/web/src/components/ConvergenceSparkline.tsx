interface Props {
  history: number[]
  sane: number
}

// A small line of the best delay found so far, with the sane plan drawn as a
// dashed reference. The whole point is visible at a glance: at low demand the
// line barely dips below the dashed line; at high demand it pulls well under.
export default function ConvergenceSparkline({ history, sane }: Props) {
  const W = 260
  const H = 64
  const pad = 6
  if (history.length < 2) {
    return <svg viewBox={`0 0 ${W} ${H}`} className="w-full" />
  }

  const all = history.concat(sane)
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  const span = hi - lo || 1
  const x = (i: number) => pad + (i / (history.length - 1)) * (W - 2 * pad)
  const y = (v: number) => pad + (1 - (v - lo) / span) * (H - 2 * pad)

  const pts = history.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const sy = y(sane)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="optimiser convergence">
      <line x1={pad} y1={sy} x2={W - pad} y2={sy} stroke="var(--color-muted)" strokeWidth={1} strokeDasharray="4 4" opacity={0.7} />
      <polyline points={pts} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(history.length - 1)} cy={y(history[history.length - 1])} r={3} fill="var(--color-accent)" />
    </svg>
  )
}
