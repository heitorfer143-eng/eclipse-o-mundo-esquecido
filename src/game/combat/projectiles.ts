import * as THREE from 'three'
import type { ElementId } from '../data/types'
import type { Collider } from '../world/collision'
import { Effects } from './effects'

export type ProjectileKind = 'flecha' | 'energia' | 'sombra' | 'fogo' | 'gelo' | 'raio' | 'terra' | 'vento'

export type ProjectileSpec = {
  owner: 'player' | 'enemy'
  position: THREE.Vector3
  direction: THREE.Vector3
  speed: number
  damage: number
  radius: number
  kind: ProjectileKind
  color: string
  element?: ElementId
  life?: number
  pierce?: number
  homing?: number
  aoeRadius?: number
  heal?: number
  crit?: boolean
}

export type ProjectileTarget = {
  position: THREE.Vector3
  radius: number
  height: number
  alive: boolean
  takeDamage: (amount: number, element?: ElementId, crit?: boolean, from?: THREE.Vector3) => void
}

export type ProjectileContext = {
  enemies: ProjectileTarget[]
  player: ProjectileTarget
  groundAt: (x: number, z: number, feetY: number) => number
  colliders: (x: number, z: number) => readonly Collider[]
  onPlayerHit: (projectile: Projectile, target: ProjectileTarget) => void
  onEnemyHit: (projectile: Projectile, target: ProjectileTarget) => void
}

type Projectile = ProjectileSpec & {
  mesh: THREE.Mesh
  velocity: THREE.Vector3
  travelled: number
  hits: Set<ProjectileTarget>
  trailTimer: number
}

const GEO_CACHE = new Map<string, THREE.BufferGeometry>()
function geometryFor(kind: ProjectileKind): THREE.BufferGeometry {
  const cached = GEO_CACHE.get(kind)
  if (cached) return cached
  let geometry: THREE.BufferGeometry
  if (kind === 'flecha') {
    const shaft = new THREE.CylinderGeometry(0.035, 0.035, 0.9, 5)
    shaft.rotateX(Math.PI / 2)
    const tip = new THREE.ConeGeometry(0.07, 0.22, 5)
    tip.rotateX(Math.PI / 2)
    tip.translate(0, 0, -0.55)
    shaft.translate(0, 0, -0.05)
    geometry = mergeSimple([shaft, tip])
  } else {
    geometry = new THREE.IcosahedronGeometry(0.22, 1)
  }
  GEO_CACHE.set(kind, geometry)
  return geometry
}

function mergeSimple(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  for (const g of geometries) {
    const pos = g.getAttribute('position')
    const nor = g.getAttribute('normal')
    const index = g.getIndex()
    if (index) {
      for (let i = 0; i < index.count; i += 1) {
        const vi = index.getX(i)
        positions.push(pos.getX(vi), pos.getY(vi), pos.getZ(vi))
        normals.push(nor.getX(vi), nor.getY(vi), nor.getZ(vi))
      }
    } else {
      for (let i = 0; i < pos.count; i += 1) {
        positions.push(pos.getX(i), pos.getY(i), pos.getZ(i))
        normals.push(nor.getX(i), nor.getY(i), nor.getZ(i))
      }
    }
    g.dispose()
  }
  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  return merged
}

/** Projectiles for both sides: arrows, magic bolts and boss volleys. */
export class Projectiles {
  private readonly list: Projectile[] = []
  private readonly group = new THREE.Group()
  private readonly materials = new Map<string, THREE.MeshStandardMaterial>()

  constructor(scene: THREE.Scene, private readonly effects: Effects) {
    scene.add(this.group)
  }

  private material(color: string, kind: ProjectileKind): THREE.MeshStandardMaterial {
    const key = `${color}-${kind}`
    const cached = this.materials.get(key)
    if (cached) return cached
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: new THREE.Color(color),
      emissiveIntensity: kind === 'flecha' ? 0.25 : 2.2,
      roughness: 0.4,
      metalness: kind === 'flecha' ? 0.6 : 0.1,
    })
    this.materials.set(key, material)
    return material
  }

  spawn(spec: ProjectileSpec): void {
    const mesh = new THREE.Mesh(geometryFor(spec.kind), this.material(spec.color, spec.kind))
    mesh.position.copy(spec.position)
    if (spec.kind === 'flecha') {
      mesh.lookAt(spec.position.clone().add(spec.direction))
    }
    mesh.castShadow = false
    this.group.add(mesh)
    const light = spec.kind === 'flecha' ? null : new THREE.PointLight(spec.color, 2.4, 7, 2)
    if (light) mesh.add(light)
    this.list.push({
      ...spec,
      mesh,
      velocity: spec.direction.clone().normalize().multiplyScalar(spec.speed),
      travelled: 0,
      hits: new Set(),
      trailTimer: 0,
    })
  }

  update(dt: number, ctx: ProjectileContext): void {
    for (let i = this.list.length - 1; i >= 0; i -= 1) {
      const p = this.list[i]
      p.life = (p.life ?? 3) - dt
      if (p.life <= 0) {
        this.remove(i)
        continue
      }
      if (p.homing && p.owner === 'player') {
        let best: ProjectileTarget | undefined
        let bestD = 400
        for (const enemy of ctx.enemies) {
          if (!enemy.alive || p.hits.has(enemy)) continue
          const d = enemy.position.distanceToSquared(p.mesh.position)
          if (d < bestD) {
            bestD = d
            best = enemy
          }
        }
        if (best) {
          const desired = best.position.clone().setY(best.position.y + best.height * 0.5).sub(p.mesh.position).normalize().multiplyScalar(p.speed)
          p.velocity.lerp(desired, Math.min(1, p.homing * dt))
        }
      }
      const step = p.velocity.clone().multiplyScalar(dt)
      p.mesh.position.add(step)
      p.travelled += step.length()
      if (p.kind === 'flecha') p.mesh.lookAt(p.mesh.position.clone().add(p.velocity))

      // Trail
      p.trailTimer -= dt
      if (p.trailTimer <= 0 && p.kind !== 'flecha') {
        p.trailTimer = 0.03
        this.effects.burst(p.mesh.position, p.color, 1, 0.4, 0.35, 0)
      }

      const ground = ctx.groundAt(p.mesh.position.x, p.mesh.position.z, p.mesh.position.y)
      let hitSomething = false
      if (p.mesh.position.y <= ground + 0.1) {
        this.impact(p, p.mesh.position.clone().setY(ground + 0.15), ctx)
        hitSomething = true
      }
      if (!hitSomething) {
        for (const collider of ctx.colliders(p.mesh.position.x, p.mesh.position.z)) {
          if (collider.kind !== 'box') continue
          const { minX, maxX, minZ, maxZ, top, bottom } = collider
          if (p.mesh.position.x > minX - p.radius && p.mesh.position.x < maxX + p.radius && p.mesh.position.z > minZ - p.radius && p.mesh.position.z < maxZ + p.radius && p.mesh.position.y < top && p.mesh.position.y > bottom) {
            this.impact(p, p.mesh.position.clone(), ctx)
            hitSomething = true
            break
          }
        }
      }

      if (!hitSomething && p.owner === 'player') {
        for (const enemy of ctx.enemies) {
          if (!enemy.alive || p.hits.has(enemy)) continue
          const dx = enemy.position.x - p.mesh.position.x
          const dz = enemy.position.z - p.mesh.position.z
          const dy = enemy.position.y + enemy.height * 0.5 - p.mesh.position.y
          if (dx * dx + dz * dz < (enemy.radius + p.radius) ** 2 && Math.abs(dy) < enemy.height * 0.7 + p.radius) {
            p.hits.add(enemy)
            ctx.onEnemyHit(p, enemy)
            this.effects.burst(p.mesh.position, p.color, 8, 4, 0.5)
            if ((p.pierce ?? 0) > 0) {
              p.pierce = (p.pierce ?? 0) - 1
            } else {
              this.impact(p, p.mesh.position.clone(), ctx, true)
              hitSomething = true
            }
            break
          }
        }
      } else if (!hitSomething && p.owner === 'enemy') {
        const target = ctx.player
        if (target.alive) {
          const dx = target.position.x - p.mesh.position.x
          const dz = target.position.z - p.mesh.position.z
          const dy = target.position.y + 1 - p.mesh.position.y
          if (dx * dx + dz * dz < (0.55 + p.radius) ** 2 && Math.abs(dy) < 1.3) {
            ctx.onPlayerHit(p, target)
            this.impact(p, p.mesh.position.clone(), ctx, true)
            hitSomething = true
          }
        }
      }

      if (hitSomething) this.remove(i)
    }
  }

  private impact(p: Projectile, position: THREE.Vector3, ctx: ProjectileContext, skipAoe = false): void {
    if (p.aoeRadius && p.aoeRadius > 0.5 && !skipAoe) {
      this.effects.explosion(position, p.aoeRadius, p.color)
      for (const enemy of ctx.enemies) {
        if (!enemy.alive) continue
        const distance = enemy.position.distanceTo(position)
        if (distance < p.aoeRadius + enemy.radius) {
          ctx.onEnemyHit(p, enemy)
        }
      }
    } else {
      this.effects.burst(position, p.color, 10, 4, 0.45)
    }
  }

  private remove(index: number): void {
    const p = this.list[index]
    p.mesh.removeFromParent()
    this.list.splice(index, 1)
  }

  clear(): void {
    for (const p of this.list) p.mesh.removeFromParent()
    this.list.length = 0
  }

  get activeCount(): number {
    return this.list.length
  }
}

export type { Projectile }
