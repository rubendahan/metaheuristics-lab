import { useMemo } from 'react'
import { flatCeilingSweep } from '../sim/analysis'
import { fmtPct } from '../lib/format'

// The headline figure: optimiser gain over the sane plan as demand rises.
// While the network is undersaturated the bars sit under the 1% line (a flat
// ceiling, the optimiser earns nothing). Past capacity they shoot up, so timing
// finally matters. Computed in the browser from the same model as the live demo.
export default function FlatCeilingChart() {
  const rows = useMemo(
    () => flatCeilingSweep([0.4, 0.55, 0.7, 0.85, 0.95, 1.1, 1.25], { iters: 60 }),
    [],
  )

  const W = 720
  const H = 320
  const padL = 52
  const padR = 18
  const padT = 22
  const padB = 64
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  const maxGain = Math.max(5, ...rows.map((r) => r.gainPct))
  const yMax = Math.ceil(maxGain / 5) * 5
  const y = (g: number) => padT + (1 - Math.max(0, g) / yMax) * plotH
  const bandW = plotW / rows.length
  const barW = bandW * 0.5

  const ticks = [0, 1, ...Array.from({ length: Math.floor(yMax / 5) }, (_, i) => (i + 1) * 5)]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="optimiser gain versus demand">
      {/* y gridlines and labels */}
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={padL}
            x2={W - padR}
            y1={y(t)}
            y2={y(t)}
            stroke={t === 1 ? 'var(--color-jam)' : 'var(--color-line)'}
            strokeWidth={t === 1 ? 1.4 : 1}
            strokeDasharray={t === 1 ? '5 4' : undefined}
          />
          <text x={padL - 8} y={y(t) + 3} textAnchor="end" className="tnum" fontSize={11} fill="var(--color-muted)">
            {t}%
          </text>
        </g>
      ))}
      <text x={W - padR} y={y(1) - 6} textAnchor="end" fontSize={11} fill="var(--color-jam)">
        1% flat-ceiling line
      </text>

      {/* bars */}
      {rows.map((r, i) => {
        const cx = padL + bandW * (i + 0.5)
        const top = y(r.gainPct)
        const color = r.flatCeiling ? 'var(--color-accent)' : 'var(--color-jam)'
        const base = y(0)
        return (
          <g key={r.load}>
            <rect
              x={cx - barW / 2}
              y={top}
              width={barW}
              height={Math.max(0, base - top)}
              rx={3}
              fill={color}
              opacity={r.flatCeiling ? 0.45 : 0.9}
            />
            <text x={cx} y={top - 6} textAnchor="middle" className="tnum" fontSize={11} fontWeight={600} fill="var(--color-ink)">
              {fmtPct(r.gainPct, r.gainPct < 1 ? 2 : 1)}
            </text>
            <text x={cx} y={H - padB + 18} textAnchor="middle" className="tnum" fontSize={11} fill="var(--color-ink)">
              {r.load.toFixed(2)}
            </text>
            <text x={cx} y={H - padB + 33} textAnchor="middle" className="tnum" fontSize={10} fill="var(--color-muted)">
              x̄ {r.meanSat.toFixed(2)}
            </text>
          </g>
        )
      })}

      {/* axes captions */}
      <text x={padL + plotW / 2} y={H - 6} textAnchor="middle" fontSize={12} fill="var(--color-muted)">
        network load (and mean degree of saturation x̄)
      </text>
    </svg>
  )
}
