// Small formatting and colour helpers shared by the map and the charts.

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 })

// Total delay comes out in vehicle-seconds and runs into the millions, so show
// it compactly (2.2M) with the unit spelled out where there is room.
export function fmtDelay(v: number): string {
  return compact.format(v)
}

export function fmtPct(v: number, digits = 1): string {
  const s = v.toFixed(digits)
  return `${v > 0 ? '+' : ''}${s}%`
}

// Traffic-light colour for a degree of saturation x = q / (s*g). Green while the
// movement clears every cycle, amber as it loads up, red once it cannot keep up.
const FLOW: [number, number, number] = [24, 165, 88]
const WARN: [number, number, number] = [232, 163, 23]
const JAM: [number, number, number] = [229, 72, 77]

function lerp(a: [number, number, number], b: [number, number, number], t: number): string {
  const c = a.map((av, i) => Math.round(av + (b[i] - av) * t))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

export function satColor(x: number): string {
  if (x <= 0.6) return lerp(FLOW, WARN, Math.max(0, x / 0.6) * 0.35)
  if (x <= 0.9) return lerp(WARN, JAM, (x - 0.6) / 0.3)
  return lerp(JAM, [150, 20, 30], Math.min(1, (x - 0.9) / 0.4))
}
