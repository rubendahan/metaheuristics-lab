// The bridge between a flat decision vector and a structured signal plan.
//
// The optimiser works on a plain vector in the unit cube [0, 1]^d. The
// simulator wants, per intersection, a set of green splits that sum to 1 plus
// an offset. This module translates between the two. Port of delta/plan.py.
//
// Layout of the decision vector, per intersection in network order:
//   * nPhases raw split weights in [0, 1]. These are not the splits themselves;
//     they are normalised and floored at the minimum green inside fromVector so
//     the splits always sum to 1 and respect the safety minimum. Optimising
//     unconstrained weights and normalising afterward is much friendlier to a
//     box-constrained swarm than enforcing a sum-to-one constraint directly.
//   * one offset gene in [0, 1], later scaled to [0, cycle) seconds.

import type { Intersection, RoadNetwork } from './network'
import { maxFlowRatio } from './network'

export interface IntersectionTiming {
  splits: number[] // green split per phase, sums to 1
  offset: number // seconds, in [0, cycle)
  cycleLength: number // seconds
}

export class SignalPlan {
  readonly net: RoadNetwork
  private readonly blockStart: number[]
  readonly dim: number

  constructor(net: RoadNetwork) {
    this.net = net
    // Per intersection: one weight per phase plus one offset gene.
    const starts: number[] = [0]
    for (const inter of net.intersections) {
      starts.push(starts[starts.length - 1] + inter.phases.length + 1)
    }
    this.blockStart = starts
    this.dim = starts[starts.length - 1]
  }

  // Decode a unit-cube vector into valid per-intersection timings. The two
  // physical constraints (splits sum to 1, every split at least the minimum
  // green) are enforced here, not by the optimiser.
  fromVector(x: number[]): IntersectionTiming[] {
    const timings: IntersectionTiming[] = []
    this.net.intersections.forEach((inter, k) => {
      const start = this.blockStart[k]
      const n = inter.phases.length
      const cycle = inter.cycleLength
      const weights = x.slice(start, start + n)

      const total = weights.reduce((a, b) => a + b, 0)
      let splits =
        total <= 1e-9 ? weights.map(() => 1 / n) : weights.map((w) => w / total)

      // Reserve the minimum green for every phase, then hand the remaining
      // fraction out in proportion to the weights. This makes the floor exact
      // and the splits still sum to 1. The floor is capped at 1/n so n phases
      // always fit.
      const minFrac = Math.min(inter.minGreen / cycle, 1 / n)
      const free = 1 - n * minFrac
      splits = splits.map((sp) => minFrac + free * sp)

      const offset = x[start + n] * cycle
      timings.push({ splits, offset, cycleLength: cycle })
    })
    return timings
  }

  // The literal "all green, never stop anyone" baseline: an equal share of the
  // cycle for every phase and a zero offset. The naive do-nothing reference.
  allGreen(): number[] {
    const x = new Array(this.dim).fill(0)
    this.net.intersections.forEach((inter, k) => {
      const start = this.blockStart[k]
      const n = inter.phases.length
      for (let i = 0; i < n; i++) x[start + i] = 1 // equal weights normalise to 1/n
      x[start + n] = 0 // offset gene
    })
    return x
  }

  // The "sane plan": green split proportional to demand, the textbook Webster
  // rule of thumb, with zero offset. What a traffic engineer writes down in five
  // minutes with no optimisation at all. The Delta finding is that on an
  // undersaturated network this is already within about 1% of what an expensive
  // optimiser reaches.
  proportional(): number[] {
    const x = new Array(this.dim).fill(0)
    this.net.intersections.forEach((inter, k) => {
      const start = this.blockStart[k]
      const n = inter.phases.length
      inter.phases.forEach((phase, i) => {
        x[start + i] = Math.max(maxFlowRatio(phase), 1e-6)
      })
      x[start + n] = 0
    })
    return x
  }
}

export function criticalSum(inter: Intersection): number {
  return inter.phases.reduce((sum, p) => sum + maxFlowRatio(p), 0)
}
