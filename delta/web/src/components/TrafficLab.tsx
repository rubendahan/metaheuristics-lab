import { useEffect, useMemo, useRef, useState } from 'react'
import { buildCity, meanSaturation } from '../sim/network'
import { SignalPlan } from '../sim/plan'
import { evaluate } from '../sim/delay'
import { MultiSwarm } from '../sim/pso'
import { fmtDelay, fmtPct } from '../lib/format'
import CityMap from './CityMap'
import ConvergenceSparkline from './ConvergenceSparkline'

type Mode = 'all-green' | 'sane' | 'optimized'
const TARGET_ITERS = 60
// One swarm generation every STEP_MS, so the run takes a few seconds and you can
// watch the green waves form and the convergence trace draw. The map redraws
// continuously between steps, so motion stays smooth.
const STEP_MS = 150

export default function TrafficLab() {
  const [load, setLoad] = useState(0.55)
  const seed = 0

  const { net, plan, saneVec, allGreenVec, saneDelay, meanSat } = useMemo(() => {
    const net = buildCity({ load, seed })
    const plan = new SignalPlan(net)
    const saneVec = plan.proportional()
    const allGreenVec = plan.allGreen()
    return {
      net,
      plan,
      saneVec,
      allGreenVec,
      saneDelay: evaluate(net, plan, saneVec),
      meanSat: meanSaturation(net),
    }
  }, [load])

  const [vector, setVector] = useState<number[]>(saneVec)
  const [mode, setMode] = useState<Mode>('sane')
  const [running, setRunning] = useState(false)
  const [history, setHistory] = useState<number[]>([])
  const [iter, setIter] = useState(0)
  const swarmRef = useRef<MultiSwarm | null>(null)
  const rafRef = useRef(0)

  const stop = () => {
    clearTimeout(rafRef.current)
    setRunning(false)
  }

  // Rebuilding the city (new load) resets the view to the sane plan.
  useEffect(() => {
    clearTimeout(rafRef.current)
    setRunning(false)
    setVector(saneVec)
    setMode('sane')
    setHistory([])
    setIter(0)
  }, [saneVec])

  useEffect(() => () => clearTimeout(rafRef.current), [])

  const showAllGreen = () => {
    stop()
    setVector(allGreenVec)
    setMode('all-green')
    setHistory([])
  }
  const showSane = () => {
    stop()
    setVector(saneVec)
    setMode('sane')
    setHistory([])
  }
  const optimize = () => {
    clearTimeout(rafRef.current)
    const func = (x: number[]) => evaluate(net, plan, x)
    const sw = new MultiSwarm(func, plan.dim, { seed, init: saneVec })
    swarmRef.current = sw
    setMode('optimized')
    setRunning(true)
    setHistory([sw.bestF])
    setIter(0)
    const loop = () => {
      sw.step()
      setVector(sw.bestX.slice())
      setHistory(sw.history.slice())
      setIter(sw.iter)
      if (sw.iter >= TARGET_ITERS) {
        setRunning(false)
        return
      }
      rafRef.current = window.setTimeout(loop, STEP_MS)
    }
    rafRef.current = window.setTimeout(loop, STEP_MS)
  }

  const currentDelay = useMemo(() => evaluate(net, plan, vector), [net, plan, vector])
  const gainPct = ((saneDelay - currentDelay) / saneDelay) * 100
  const undersaturated = meanSat < 0.8

  const btn = (active: boolean) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition ${
      active
        ? 'bg-[var(--color-ink)] text-white'
        : 'bg-white text-[var(--color-ink)] ring-1 ring-[var(--color-line)] hover:ring-[var(--color-muted)]'
    }`

  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
      {/* the city */}
      <div className="flex flex-col">
        <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-[var(--color-night)] ring-1 ring-[var(--color-line)]">
          <CityMap net={net} plan={plan} vector={vector} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[var(--color-muted)]">
          <Legend color="#18a558" label="flowing" />
          <Legend color="#e8a317" label="loading up" />
          <Legend color="#e5484d" label="saturated" />
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5" style={{ background: '#18a558' }} /> green wave
          </span>
          <span>ring = green split</span>
        </div>
      </div>

      {/* the controls */}
      <div className="flex flex-col gap-5">
        <div>
          <div className="flex items-baseline justify-between">
            <label className="text-sm font-semibold">Network demand</label>
            <span className="tnum text-sm text-[var(--color-muted)]">
              load {load.toFixed(2)} · x̄ {meanSat.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={0.3}
            max={1.3}
            step={0.05}
            value={load}
            onChange={(e) => setLoad(parseFloat(e.target.value))}
            className="mt-2 w-full accent-[#2f6df6]"
          />
          <div className="mt-1 flex justify-between text-xs text-[var(--color-muted)]">
            <span>undersaturated</span>
            <span>over capacity</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className={btn(mode === 'all-green')} onClick={showAllGreen}>
            All-green
          </button>
          <button className={btn(mode === 'sane')} onClick={showSane}>
            Sane plan
          </button>
          <button
            className="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
            onClick={optimize}
            disabled={running}
          >
            {running ? `Optimising… ${iter}/${TARGET_ITERS}` : 'Optimise ▶'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Stat label="Total delay" value={`${fmtDelay(currentDelay)}`} unit="veh·s" />
          <Stat
            label="vs sane plan"
            value={mode === 'sane' ? 'baseline' : fmtPct(gainPct)}
            tone={mode === 'sane' ? 'muted' : gainPct > 0.05 ? 'good' : gainPct < -0.05 ? 'bad' : 'muted'}
            unit={mode === 'sane' ? 'reference' : gainPct > 0 ? 'better' : 'worse'}
          />
        </div>

        <div className="rounded-xl bg-[var(--color-card)] p-4 ring-1 ring-[var(--color-line)]">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">
              {undersaturated ? 'Flat ceiling' : 'Timing matters'}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                background: undersaturated ? 'var(--color-accent-soft)' : '#fdecec',
                color: undersaturated ? 'var(--color-accent)' : 'var(--color-jam)',
              }}
            >
              x̄ {meanSat.toFixed(2)}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-[var(--color-muted)]">
            {undersaturated
              ? 'Every movement clears its queue each cycle, so the optimiser finds almost nothing the sane plan missed. This is the regime the real Delta network was in.'
              : 'Queues no longer clear within a cycle. Now the offsets and splits the optimiser tunes save real time.'}
          </p>
          {history.length > 1 && (
            <div className="mt-3">
              <div className="mb-1 text-xs text-[var(--color-muted)]">
                best delay vs sane plan (dashed)
              </div>
              <ConvergenceSparkline history={history} sane={saneDelay} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

function Stat({
  label,
  value,
  unit,
  tone = 'ink',
}: {
  label: string
  value: string
  unit?: string
  tone?: 'ink' | 'good' | 'bad' | 'muted'
}) {
  const color =
    tone === 'good'
      ? 'var(--color-flow)'
      : tone === 'bad'
        ? 'var(--color-jam)'
        : tone === 'muted'
          ? 'var(--color-muted)'
          : 'var(--color-ink)'
  return (
    <div className="rounded-xl bg-[var(--color-card)] p-4 ring-1 ring-[var(--color-line)]">
      <div className="text-xs text-[var(--color-muted)]">{label}</div>
      <div className="tnum mt-1 text-2xl font-semibold" style={{ color }}>
        {value}
      </div>
      {unit && <div className="text-xs text-[var(--color-muted)]">{unit}</div>}
    </div>
  )
}
