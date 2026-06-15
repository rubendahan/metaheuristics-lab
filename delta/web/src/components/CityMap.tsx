import { useEffect, useRef } from 'react'
import type { RoadNetwork } from '../sim/network'
import type { SignalPlan } from '../sim/plan'
import { intersectionStats } from '../sim/delay'
import { satColor } from '../lib/format'

interface Props {
  net: RoadNetwork
  plan: SignalPlan
  vector: number[]
}

// The city, drawn on a dark canvas. Each junction is a node coloured by its
// worst movement saturation (green flowing, red jammed) with a ring that shows
// the green split. Corridors that are well coordinated carry a flowing green
// wave; badly coordinated ones show a faint red link.
export default function CityMap({ net, plan, vector }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Latest props in refs so the animation loop always draws the current plan
  // without restarting on every optimiser step.
  const props = useRef({ net, plan, vector })
  props.current = { net, plan, vector }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let dash = 0

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.floor(rect.width * dpr)
      canvas.height = Math.floor(rect.height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const draw = () => {
      const { net, plan, vector } = props.current
      const rect = canvas.getBoundingClientRect()
      const W = rect.width
      const H = rect.height
      ctx.clearRect(0, 0, W, H)

      const pad = 34
      const maxCol = Math.max(1, net.width - 1)
      const maxRow = Math.max(1, net.height - 1)
      const px = (col: number) => pad + (col / maxCol) * (W - 2 * pad)
      const py = (row: number) => pad + (row / maxRow) * (H - 2 * pad)

      const stats = intersectionStats(net, plan, vector)
      const timings = plan.fromVector(vector)
      const node = (k: number) => [px(net.intersections[k].col), py(net.intersections[k].row)] as const

      // base road grid: right and down neighbours
      ctx.lineWidth = 6
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'
      const byColRow = new Map<string, number>()
      net.intersections.forEach((it, k) => byColRow.set(`${it.col},${it.row}`, k))
      net.intersections.forEach((it, k) => {
        const [x0, y0] = node(k)
        const right = byColRow.get(`${it.col + 1},${it.row}`)
        const down = byColRow.get(`${it.col},${it.row + 1}`)
        if (right != null) {
          const [x1, y1] = node(right)
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
        }
        if (down != null) {
          const [x1, y1] = node(down)
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
        }
      })

      // corridor coordination: green wave when offsets line up, red when they fight
      const ideal = net.freeFlowTravelTime
      ctx.lineCap = 'round'
      for (const corridor of net.corridors) {
        for (let i = 0; i + 1 < corridor.length; i++) {
          const a = corridor[i]
          const b = corridor[i + 1]
          const ta = timings[a]
          const tb = timings[b]
          const C = 0.5 * (ta.cycleLength + tb.cycleLength)
          let err = (((tb.offset - ta.offset - ideal) % C) + C) % C
          if (err > C / 2) err -= C
          const factor = (Math.abs(err) / (C / 2)) * 2 - 1 // -1 perfect, +1 worst
          const [x0, y0] = node(a)
          const [x1, y1] = node(b)
          if (factor < -0.15) {
            const good = Math.min(1, -factor)
            ctx.strokeStyle = `rgba(24,165,88,${0.35 + 0.5 * good})`
            ctx.lineWidth = 3
            ctx.setLineDash([10, 8])
            ctx.lineDashOffset = -dash
            ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
            ctx.setLineDash([])
          } else if (factor > 0.3) {
            ctx.strokeStyle = `rgba(229,72,77,${0.25 * factor})`
            ctx.lineWidth = 2.5
            ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
          }
        }
      }

      // junctions
      net.intersections.forEach((_inter, k) => {
        const [x, y] = node(k)
        const { sat } = stats[k]
        const color = satColor(sat)
        const r = 9

        // soft glow
        ctx.beginPath()
        ctx.fillStyle = color
        ctx.globalAlpha = 0.18
        ctx.arc(x, y, r * 2.1, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1

        // split ring: green arc = main-street share of the cycle
        const mainSplit = timings[k].splits[0]
        ctx.lineWidth = 3
        ctx.strokeStyle = 'rgba(255,255,255,0.16)'
        ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.stroke()
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'
        ctx.beginPath()
        ctx.arc(x, y, r + 4, -Math.PI / 2, -Math.PI / 2 + mainSplit * Math.PI * 2)
        ctx.stroke()

        // core
        ctx.beginPath()
        ctx.fillStyle = color
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.55)'
        ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.34, 0, Math.PI * 2); ctx.fill()
      })

      dash = (dash + 0.6) % 18
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return <canvas ref={canvasRef} className="h-full w-full rounded-xl" />
}
