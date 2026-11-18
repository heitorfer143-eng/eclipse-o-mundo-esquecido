/**
 * Deterministic pseudo-random utilities. Every procedural decision in the world (terrain, props,
 * POIs, loot rolls) derives from the save's seed, so the same seed always rebuilds the same world.
 */

/** Fast, well-distributed 32-bit PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Stable 32-bit hash of a string, used to turn a save seed into a numeric world seed. */
export function hashString(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Integer hash of two coordinates (deterministic across platforms). */
export function hash2(x: number, y: number, seed = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export function hash3(x: number, y: number, z: number, seed = 0): number {
  return hash2(Math.imul(x | 0, 73856093) ^ (z | 0), y, seed)
}

const smooth = (t: number) => t * t * (3 - 2 * t)

/** Smooth value noise in [0, 1]; `period` wraps the lattice so chunk borders stay seamless. */
export function valueNoise2(x: number, y: number, seed = 0, period = 0): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = smooth(x - x0)
  const fy = smooth(y - y0)
  const wrap = (v: number) => (period > 0 ? ((v % period) + period) % period : v)
  const a = hash2(wrap(x0), wrap(y0), seed)
  const b = hash2(wrap(x0 + 1), wrap(y0), seed)
  const c = hash2(wrap(x0), wrap(y0 + 1), seed)
  const d = hash2(wrap(x0 + 1), wrap(y0 + 1), seed)
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy
}

/** Fractal Brownian motion built from value noise. */
export function fbm2(x: number, y: number, seed = 0, octaves = 4, lacunarity = 2, gain = 0.5): number {
  let sum = 0
  let amp = 1
  let norm = 0
  let freq = 1
  for (let i = 0; i < octaves; i += 1) {
    sum += valueNoise2(x * freq, y * freq, seed + i * 1013) * amp
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return sum / norm
}

/** Ridged noise: sharp crests, used for mountain ranges. */
export function ridged2(x: number, y: number, seed = 0, octaves = 4): number {
  let sum = 0
  let amp = 1
  let norm = 0
  let freq = 1
  for (let i = 0; i < octaves; i += 1) {
    const n = 1 - Math.abs(valueNoise2(x * freq, y * freq, seed + i * 733) * 2 - 1)
    sum += n * n * amp
    norm += amp
    amp *= 0.5
    freq *= 2
  }
  return sum / norm
}

export function pick<T>(random: () => number, list: readonly T[]): T {
  return list[Math.floor(random() * list.length) % list.length]
}

export function range(random: () => number, min: number, max: number): number {
  return min + random() * (max - min)
}

export function intRange(random: () => number, min: number, max: number): number {
  return Math.floor(min + random() * (max - min + 1))
}

export function chance(random: () => number, probability: number): boolean {
  return random() < probability
}
