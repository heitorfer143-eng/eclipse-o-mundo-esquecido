export const clamp = (v: number, min: number, max: number): number => (v < min ? min : v > max ? max : v)
export const clamp01 = (v: number): number => clamp(v, 0, 1)
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
export const inverseLerp = (a: number, b: number, v: number): number => (b === a ? 0 : clamp01((v - a) / (b - a)))
export const smoothstep = (a: number, b: number, v: number): number => {
  const t = inverseLerp(a, b, v)
  return t * t * (3 - 2 * t)
}

/** Frame-rate independent exponential approach. */
export const damp = (from: number, to: number, lambda: number, dt: number): number => lerp(from, to, 1 - Math.exp(-lambda * dt))

export function wrapAngle(a: number): number {
  let x = (a + Math.PI) % (Math.PI * 2)
  if (x < 0) x += Math.PI * 2
  return x - Math.PI
}

export function angleDiff(from: number, to: number): number {
  return wrapAngle(to - from)
}

export function dampAngle(from: number, to: number, lambda: number, dt: number): number {
  return wrapAngle(from + angleDiff(from, to) * (1 - Math.exp(-lambda * dt)))
}

export function approach(value: number, target: number, maxDelta: number): number {
  if (value < target) return Math.min(target, value + maxDelta)
  return Math.max(target, value - maxDelta)
}

/** Deterministic easing curves for UI and effects. */
export const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3
export const easeInQuad = (t: number): number => t * t
export const easeOutBack = (t: number): number => {
  const c = 1.70158
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2
}
