// Multi-population particle swarm optimisation, written so the UI can advance it
// one generation at a time and draw the city in between.
//
// This mirrors the approach the Delta team used: three sub-swarms with different
// temperaments (one exploratory, one balanced, one exploitative) all sharing a
// single global best. The shared best is the coupling; each swarm pulls toward
// it at its own strength, so the exploratory swarm keeps finding new regions
// while the exploitative one refines what the group has already found.

import { rngFrom } from './rng'

export type Objective = (x: number[]) => number

interface Particle {
  x: number[]
  v: number[]
  px: number[] // personal best position
  pf: number // personal best value
}

interface SwarmTemperament {
  name: string
  w: number // inertia
  c1: number // pull to personal best
  c2: number // pull to global best
  n: number // particles
}

const TEMPERAMENTS: SwarmTemperament[] = [
  { name: 'exploratory', w: 0.85, c1: 1.8, c2: 0.9, n: 16 },
  { name: 'balanced', w: 0.72, c1: 1.5, c2: 1.5, n: 16 },
  { name: 'exploitative', w: 0.55, c1: 0.9, c2: 2.0, n: 16 },
]

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export class MultiSwarm {
  readonly dim: number
  iter = 0
  bestX: number[]
  bestF = Infinity
  history: number[] = []

  private func: Objective
  private rand: () => number
  private vmax: number
  private swarms: { parts: Particle[]; t: SwarmTemperament }[] = []

  // `init` warm-starts the search from a known-good plan (in practice the
  // demand-proportional Webster plan). One particle per swarm is placed on it,
  // the rest start spread across the cube. Warm-starting from a domain heuristic
  // is where most of the real gains come from, and it keeps the optimiser from
  // ever doing worse than the sane plan it began with.
  constructor(func: Objective, dim: number, opts: { seed?: number; init?: number[] } = {}) {
    this.func = func
    this.dim = dim
    this.rand = rngFrom(opts.seed ?? 12345)
    this.vmax = 0.3 // positions live in [0, 1], so a 0.3 velocity cap is generous
    this.bestX = new Array(dim).fill(0.5)

    for (const t of TEMPERAMENTS) {
      const parts: Particle[] = []
      for (let i = 0; i < t.n; i++) {
        // Seed each swarm's first particle on the warm-start plan (with a touch
        // of jitter after the first so the swarms do not all collapse together).
        let x: number[]
        if (opts.init && i === 0) {
          x = opts.init.map((v) =>
            this.swarms.length === 0 ? v : Math.max(0, Math.min(1, v + 0.04 * (this.rand() - 0.5))),
          )
        } else {
          x = Array.from({ length: dim }, () => this.rand())
        }
        const f = this.func(x)
        parts.push({ x, v: new Array(dim).fill(0), px: x.slice(), pf: f })
        if (f < this.bestF) {
          this.bestF = f
          this.bestX = x.slice()
        }
      }
      this.swarms.push({ parts, t })
    }
    this.history.push(this.bestF)
  }

  step(): void {
    this.iter++
    for (const { parts, t } of this.swarms) {
      for (const p of parts) {
        for (let d = 0; d < this.dim; d++) {
          const r1 = this.rand()
          const r2 = this.rand()
          let v =
            t.w * p.v[d] +
            t.c1 * r1 * (p.px[d] - p.x[d]) +
            t.c2 * r2 * (this.bestX[d] - p.x[d])
          v = clamp(v, -this.vmax, this.vmax)
          p.v[d] = v
          p.x[d] = clamp(p.x[d] + v, 0, 1)
        }
        const f = this.func(p.x)
        if (f < p.pf) {
          p.pf = f
          p.px = p.x.slice()
          if (f < this.bestF) {
            this.bestF = f
            this.bestX = p.x.slice()
          }
        }
      }
    }
    this.history.push(this.bestF)
  }

  // Total particle count, handy for the live read-outs.
  get nParticles(): number {
    return this.swarms.reduce((sum, s) => sum + s.t.n, 0)
  }
}

// Best objective value found by sampling `n` random plans. The honest reference
// for "did the swarm actually do anything a coin flip would not".
export function randomBaseline(func: Objective, dim: number, n: number, seed = 7): number {
  const rand = rngFrom(seed)
  let best = Infinity
  for (let i = 0; i < n; i++) {
    const x = Array.from({ length: dim }, () => rand())
    best = Math.min(best, func(x))
  }
  return best
}
