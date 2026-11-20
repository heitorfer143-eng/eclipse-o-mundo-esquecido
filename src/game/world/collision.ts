/** Lightweight collision primitives for the open world (terrain is handled by height sampling). */

export type CircleCollider = {
  kind: 'circle'
  x: number
  z: number
  radius: number
  /** Top of the obstacle; `0` means it blocks fully (trees, walls). */
  top?: number
  bottom?: number
}

export type BoxCollider = {
  kind: 'box'
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  top: number
  bottom: number
  /** Walkable roof/platform: the player can stand on `top`. */
  solidTop?: boolean
  /** Blocks movement horizontally. */
  blocking?: boolean
  /** Exclusion volume for ambient NPC navigation; never blocks the player. */
  npcBlocking?: boolean
}

export type Collider = CircleCollider | BoxCollider

/** Push a circle out of a collider; returns the corrected position (mutates nothing). */
export function resolveCircle(px: number, pz: number, radius: number, collider: Collider, feetY: number, headY: number, includeNpcOnly = false): { x: number; z: number } | null {
  if (collider.kind === 'circle') {
    const top = collider.top ?? 0
    if (top > 0 && feetY > top - 0.05) return null
    const dx = px - collider.x
    const dz = pz - collider.z
    const min = radius + collider.radius
    const distSq = dx * dx + dz * dz
    if (distSq >= min * min || distSq < 1e-8) return null
    const dist = Math.sqrt(distSq)
    const push = (min - dist) / dist
    return { x: px + dx * push, z: pz + dz * push }
  }
  if (collider.blocking === false && !(includeNpcOnly && collider.npcBlocking)) return null
  if (feetY > collider.top - 0.12 || headY < collider.bottom) return null
  const cx = Math.max(collider.minX, Math.min(px, collider.maxX))
  const cz = Math.max(collider.minZ, Math.min(pz, collider.maxZ))
  const dx = px - cx
  const dz = pz - cz
  const distSq = dx * dx + dz * dz
  if (distSq > radius * radius) return null
  if (distSq > 1e-6) {
    const dist = Math.sqrt(distSq)
    const push = (radius - dist) / dist
    return { x: px + dx * push, z: pz + dz * push }
  }
  // Centre inside the box: push out along the shallowest axis.
  const left = px - collider.minX
  const right = collider.maxX - px
  const back = pz - collider.minZ
  const front = collider.maxZ - pz
  const min = Math.min(left, right, back, front)
  if (min === left) return { x: collider.minX - radius, z: pz }
  if (min === right) return { x: collider.maxX + radius, z: pz }
  if (min === back) return { x: px, z: collider.minZ - radius }
  return { x: px, z: collider.maxZ + radius }
}

/** Highest walkable surface under the player: terrain height plus box tops they can stand on. */
export function supportHeight(px: number, pz: number, feetY: number, terrainHeight: number, colliders: readonly Collider[], step = 0.65): number {
  let best = terrainHeight
  for (const c of colliders) {
    if (c.kind !== 'box') continue
    if (c.solidTop === false) continue
    if (px < c.minX - 0.25 || px > c.maxX + 0.25 || pz < c.minZ - 0.25 || pz > c.maxZ + 0.25) continue
    if (c.top <= feetY + step && c.top > best) best = c.top
  }
  return best
}

export function collidersNearPoint(list: readonly Collider[], x: number, z: number, radius: number, out: Collider[]): Collider[] {
  for (const c of list) {
    if (c.kind === 'circle') {
      if (Math.hypot(c.x - x, c.z - z) <= radius + c.radius) out.push(c)
    } else {
      const cx = Math.max(c.minX, Math.min(x, c.maxX))
      const cz = Math.max(c.minZ, Math.min(z, c.maxZ))
      if (Math.hypot(cx - x, cz - z) <= radius) out.push(c)
    }
  }
  return out
}

export function colliderContains(c: Collider, x: number, z: number): boolean {
  if (c.kind === 'circle') return Math.hypot(x - c.x, z - c.z) <= c.radius
  return x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ
}
