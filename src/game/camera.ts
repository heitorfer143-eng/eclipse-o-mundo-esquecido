import * as THREE from 'three'
import { clamp, damp } from './core/math'
import type { Collider } from './world/collision'

export type CameraWorld = {
  groundAt: (x: number, z: number, feetY: number) => number
  collidersNear?: (x: number, z: number) => readonly Collider[]
}

/**
 * Orbiting third-person camera with terrain avoidance, sprint FOV, and trauma-based shake.
 * Yaw is shared with movement so WASD always means "away from the camera".
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera
  yaw = 0
  pitch = 0.32
  distance = 5.4
  reducedMotion = false
  private shake = 0
  private shakeTime = 0
  private readonly desired = new THREE.Vector3()
  private readonly target = new THREE.Vector3()
  private readonly lookAt = new THREE.Vector3()
  private initialized = false
  private readonly baseFov = 62
  private activeBaseFov = this.baseFov

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(this.baseFov, aspect, 0.15, 1400)
    this.camera.rotation.order = 'YXZ'
  }

  resize(width: number, height: number): void {
    const aspect = width / Math.max(1, height)
    this.camera.aspect = aspect
    this.activeBaseFov = aspect < 0.62 ? 72 : this.baseFov
    this.camera.fov = this.activeBaseFov
    this.camera.updateProjectionMatrix()
  }

  addShake(amount: number): void {
    if (this.reducedMotion) return
    this.shake = Math.min(1.4, this.shake + amount)
  }

  zoom(delta: number): void {
    this.distance = clamp(this.distance + delta * 0.0018, 2.6, 9)
  }

  reset(target: THREE.Vector3, yaw = 0): void {
    this.yaw = yaw
    this.pitch = 0.32
    this.initialized = false
    this.target.set(target.x, target.y + 1.2, target.z)
  }

  update(dt: number, target: THREE.Vector3, look: { x: number; y: number }, world: CameraWorld, sprinting: boolean, gliding: boolean): void {
    this.yaw -= look.x
    // Keep the orbit camera above the player's eye line. Negative pitch put the camera
    // below the character on touch devices after a large vertical drag.
    this.pitch = clamp(this.pitch + look.y, 0.08, 1.05)

    const wasInitialized = this.initialized
    this.target.lerp(new THREE.Vector3(target.x, target.y + 1.55, target.z), wasInitialized ? 1 - Math.exp(-14 * dt) : 1)

    const horizontal = Math.cos(this.pitch) * this.distance
    const vertical = Math.sin(this.pitch) * this.distance
    this.desired.set(
      this.target.x + Math.sin(this.yaw) * horizontal,
      this.target.y + vertical + 0.35,
      this.target.z + Math.cos(this.yaw) * horizontal,
    )

    // Keep the camera above terrain and out of steep slopes.
    const ground = world.groundAt(this.desired.x, this.desired.z, this.desired.y)
    if (this.desired.y < ground + 0.55) this.desired.y = ground + 0.55
    // Sample along the boom so hills between camera and player do not hide the character.
    for (let i = 1; i <= 4; i += 1) {
      const t = i / 4
      const sx = THREE.MathUtils.lerp(this.target.x, this.desired.x, t)
      const sz = THREE.MathUtils.lerp(this.target.z, this.desired.z, t)
      const sy = THREE.MathUtils.lerp(this.target.y, this.desired.y, t)
      const g = world.groundAt(sx, sz, sy)
      if (sy < g + 0.45) {
        this.desired.x = sx
        this.desired.y = g + 0.5
        this.desired.z = sz
        break
      }
    }

    // Shorten the boom before it crosses a house, rock, or tree trunk; otherwise
    // the camera can start inside opaque geometry and fill the whole screen.
    if (world.collidersNear) {
      const steps = 16
      for (let i = 3; i <= steps; i += 1) {
        const t = i / steps
        const x = THREE.MathUtils.lerp(this.target.x, this.desired.x, t)
        const y = THREE.MathUtils.lerp(this.target.y, this.desired.y, t)
        const z = THREE.MathUtils.lerp(this.target.z, this.desired.z, t)
        if (!this.isInsideCollider(x, y, z, world.collidersNear(x, z))) continue
        const safeT = Math.max(0.22, (i - 1) / steps)
        this.desired.set(
          THREE.MathUtils.lerp(this.target.x, this.desired.x, safeT),
          THREE.MathUtils.lerp(this.target.y, this.desired.y, safeT),
          THREE.MathUtils.lerp(this.target.z, this.desired.z, safeT),
        )
        break
      }
    }

    // Snap to a valid third-person position on the first frame after reset; smoothing
    // from the world origin made the camera sweep through/under the player.
    this.camera.position.lerp(this.desired, wasInitialized ? 1 - Math.exp(-18 * dt) : 1)
    this.initialized = true
    this.lookAt.copy(this.target)

    // Trauma shake decays quickly and never fights the player's aim.
    this.shakeTime += dt
    if (this.shake > 0.001) {
      const s = this.shake * this.shake
      this.camera.position.x += Math.sin(this.shakeTime * 61) * s * 0.35
      this.camera.position.y += Math.cos(this.shakeTime * 47) * s * 0.3
      this.camera.position.z += Math.sin(this.shakeTime * 53) * s * 0.25
      this.shake = Math.max(0, this.shake - dt * 2.6)
    }

    this.camera.lookAt(this.lookAt)
    const targetFov = this.activeBaseFov + (sprinting ? 4 : 0) + (gliding ? 6 : 0)
    this.camera.fov = damp(this.camera.fov, targetFov, 5, dt)
    this.camera.updateProjectionMatrix()
  }

  /** Attract-mode orbit used by the title screen. */
  orbit(time: number, center: THREE.Vector3, radius = 9): void {
    const angle = time * 0.12
    this.camera.position.set(center.x + Math.sin(angle) * radius, center.y + 3.2, center.z + Math.cos(angle) * radius)
    this.camera.lookAt(center.x, center.y + 0.95, center.z)
  }

  get forward(): THREE.Vector3 {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
  }

  private isInsideCollider(x: number, y: number, z: number, colliders: readonly Collider[]): boolean {
    for (const collider of colliders) {
      if (collider.kind === 'circle') {
        const top = collider.top && collider.top > 0 ? collider.top : Number.POSITIVE_INFINITY
        if (y < (collider.bottom ?? Number.NEGATIVE_INFINITY) || y > top) continue
        if (Math.hypot(x - collider.x, z - collider.z) <= collider.radius + 0.22) return true
        continue
      }
      if (collider.blocking === false || y < collider.bottom || y > collider.top) continue
      if (x >= collider.minX - 0.22 && x <= collider.maxX + 0.22 && z >= collider.minZ - 0.22 && z <= collider.maxZ + 0.22) return true
    }
    return false
  }
}
