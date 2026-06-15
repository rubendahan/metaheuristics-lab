// A small seeded RNG so every run of the city and the optimizer is reproducible.
// mulberry32 is tiny, fast and good enough for a demo; it is not cryptographic.

export type Rng = () => number

export function rngFrom(seed: number): Rng {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Standard normal via Box-Muller, used for the swarm's velocity noise.
export function gauss(rand: Rng): number {
  let u = 0
  let v = 0
  while (u === 0) u = rand()
  while (v === 0) v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function uniform(rand: Rng, lo: number, hi: number): number {
  return lo + rand() * (hi - lo)
}
