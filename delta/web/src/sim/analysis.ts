// The flat-ceiling diagnostic: characterise the objective before optimising it.
//
// This reproduces the central finding of the Delta competition. After throwing a
// whole toolbox of metaheuristics at the signal-timing problem, the most
// valuable result was not a clever optimiser but a characterisation of the
// objective: for the given demand the network sat so far below saturation that
// almost any sane plan was within about 1% of optimal. Push the demand toward
// capacity and the gap opens up, so the optimiser only earns its keep once
// timing genuinely matters. Port of delta/analysis.py.

import { buildCity, meanSaturation } from './network'
import { SignalPlan } from './plan'
import { evaluate } from './delay'
import { MultiSwarm, randomBaseline } from './pso'

export interface CeilingRow {
  load: number
  meanSat: number
  sane: number
  optimized: number
  gainPct: number // improvement of the optimiser over the sane plan
  flatCeiling: boolean
}

// Run the diagnostic across a sweep of network loads. For each load we build a
// city, take the sane (demand-proportional) plan as the no-optimisation
// reference, optimise from scratch on a fixed budget, and report the gap.
export function flatCeilingSweep(
  loads: number[],
  opts: { iters?: number; seed?: number; nIntersections?: number } = {},
): CeilingRow[] {
  const iters = opts.iters ?? 40
  const seed = opts.seed ?? 0
  const n = opts.nIntersections ?? 36

  return loads.map((load) => {
    const net = buildCity({ nIntersections: n, seed, load })
    const plan = new SignalPlan(net)
    const func = (x: number[]) => evaluate(net, plan, x)

    const saneVec = plan.proportional()
    const sane = func(saneVec)

    const swarm = new MultiSwarm(func, plan.dim, { seed, init: saneVec })
    for (let i = 0; i < iters; i++) swarm.step()
    const optimized = swarm.bestF

    const gainPct = ((sane - optimized) / sane) * 100
    return {
      load,
      meanSat: meanSaturation(net),
      sane,
      optimized,
      gainPct,
      flatCeiling: gainPct < 1,
    }
  })
}

export interface Characterization {
  meanSat: number
  allGreen: number
  sane: number
  randomBest: number
  optimized: number
  gainPct: number
  flatCeiling: boolean
}

export function characterize(
  load: number,
  opts: { iters?: number; seed?: number; nIntersections?: number } = {},
): Characterization {
  const iters = opts.iters ?? 40
  const seed = opts.seed ?? 0
  const n = opts.nIntersections ?? 36
  const net = buildCity({ nIntersections: n, seed, load })
  const plan = new SignalPlan(net)
  const func = (x: number[]) => evaluate(net, plan, x)

  const allGreen = func(plan.allGreen())
  const saneVec = plan.proportional()
  const sane = func(saneVec)
  const randomBest = randomBaseline(func, plan.dim, 100, seed)
  const swarm = new MultiSwarm(func, plan.dim, { seed, init: saneVec })
  for (let i = 0; i < iters; i++) swarm.step()
  const optimized = swarm.bestF
  const gainPct = ((sane - optimized) / sane) * 100

  return {
    meanSat: meanSaturation(net),
    allGreen,
    sane,
    randomBest,
    optimized,
    gainPct,
    flatCeiling: gainPct < 1,
  }
}
