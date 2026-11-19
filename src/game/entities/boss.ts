import * as THREE from 'three'
import type { BossAttack, BossType, ElementId } from '../data/types'
import { clamp, damp, dampAngle } from '../core/math'
import { ELEMENTS, damageAfterDefense, elementalMultiplier } from '../combat/damage'
import { buildEnemyVisual, disposeEnemyVisual, type EnemyVisual } from './enemyModels'
import type { EnemyContext } from './enemy'

export type BossEvent =
  | { type: 'aoe'; center: THREE.Vector3; radius: number; damage: number; element?: ElementId; name: string }
  | { type: 'cone'; origin: THREE.Vector3; direction: THREE.Vector3; range: number; arc: number; damage: number; element?: ElementId; name: string }
  | { type: 'projectile'; from: THREE.Vector3; dir: THREE.Vector3; speed: number; damage: number; element?: ElementId; radius: number }
  | { type: 'summon'; enemyId: string; count: number }
  | { type: 'phase'; index: number; name: string; line: string }
  | { type: 'roar' }
  | { type: 'death'; boss: Boss }

type ActiveTelegraph = {
  mesh: THREE.Mesh
  ring: THREE.Mesh
  timer: number
  total: number
  onDone: () => void
  followPlayer: boolean
  center: THREE.Vector3
}

const TELEGRAPH_GEO = new THREE.RingGeometry(0.86, 1, 40)
const MAX_BOSS_HEIGHT = 2.45

/** A story boss: three-phase patterns, telegraphed area attacks and unique rewards. */
export class Boss {
  readonly def: BossType
  readonly root = new THREE.Group()
  readonly position = new THREE.Vector3()
  readonly velocity = new THREE.Vector3()
  facing = 0
  health: number
  readonly maxHealth: number
  phaseIndex = 0
  dead = false
  finished = false
  aggro = false
  state: 'idle' | 'chase' | 'windup' | 'recover' | 'stagger' | 'dead' = 'idle'
  private readonly visual: EnemyVisual
  private readonly telegraphs: ActiveTelegraph[] = []
  private stateTimer = 0
  private cooldowns = new Map<string, number>()
  private attackCooldown = 1.5
  private deathTimer = 3
  private flash = 0
  private animPhase = 0
  private pendingAttack?: BossAttack
  private chargeDirection = new THREE.Vector3()
  private chargeTimer = 0
  private readonly aura: THREE.Mesh
  private readonly rune: THREE.Mesh

  constructor(def: BossType, x: number, z: number, level?: number) {
    this.def = def
    const levelScale = level ? 1 + Math.max(0, level - def.level) * 0.05 : 1
    this.maxHealth = Math.round(def.health * levelScale)
    this.health = this.maxHealth
    this.position.set(x, 0, z)
    this.visual = buildEnemyVisual(def.model, def.colors, def.scale)
    if (this.visual.height > MAX_BOSS_HEIGHT) {
      const fit = MAX_BOSS_HEIGHT / this.visual.height
      this.visual.root.scale.multiplyScalar(fit)
      this.visual.height = MAX_BOSS_HEIGHT
      this.visual.radius *= fit
    }
    this.root.add(this.visual.root)
    this.root.position.copy(this.position)
    for (const attack of def.attacks) this.cooldowns.set(attack.id, 2 + Math.random() * 2)

    const color = def.element ? ELEMENTS[def.element].glow : '#b98cff'
    this.aura = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, side: THREE.BackSide, depthWrite: false }),
    )
    this.aura.scale.setScalar(this.visual.radius * 2.4)
    this.aura.position.y = this.visual.height * 0.5
    this.root.add(this.aura)

    this.rune = new THREE.Mesh(
      new THREE.RingGeometry(this.visual.radius * 1.6, this.visual.radius * 1.9, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }),
    )
    this.rune.rotation.x = -Math.PI / 2
    this.rune.position.y = 0.05
    this.root.add(this.rune)
  }

  get name(): string {
    return this.def.name
  }

  get title(): string {
    return this.def.title
  }

  get phase(): { name: string; line: string } {
    const phase = this.def.phases[Math.min(this.phaseIndex, this.def.phases.length - 1)]
    return { name: phase.name, line: phase.line }
  }

  get healthRatio(): number {
    return clamp(this.health / this.maxHealth, 0, 1)
  }

  get radius(): number {
    return this.visual.radius
  }

  get height(): number {
    return this.visual.height
  }

  takeDamage(raw: number, options: { element?: ElementId; crit?: boolean; from?: THREE.Vector3 } = {}): { amount: number; crit: boolean; killed: boolean } {
    if (this.dead) return { amount: 0, crit: false, killed: false }
    let amount = damageAfterDefense(raw, this.def.defense) * elementalMultiplier(options.element, this.def.element)
    if (options.crit) amount *= 1.85
    amount = Math.max(1, Math.round(amount))
    this.health = Math.max(0, this.health - amount)
    this.flash = 1
    this.aggro = true
    if (this.health <= 0) {
      this.dead = true
      this.state = 'dead'
      this.deathTimer = 3
      this.clearTelegraphs()
    }
    return { amount, crit: options.crit === true, killed: this.dead }
  }

  private clearTelegraphs(): void {
    for (const t of this.telegraphs) {
      t.mesh.removeFromParent()
      t.ring.removeFromParent()
      t.mesh.geometry.dispose()
    }
    this.telegraphs.length = 0
  }

  private telegraph(center: THREE.Vector3, radius: number, duration: number, color: string, onDone: () => void, followPlayer = false): void {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }),
    )
    mesh.rotation.x = -Math.PI / 2
    mesh.position.copy(center).setY(center.y + 0.06)
    const ring = new THREE.Mesh(TELEGRAPH_GEO, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }))
    ring.rotation.x = -Math.PI / 2
    ring.scale.setScalar(radius)
    ring.position.copy(center).setY(center.y + 0.08)
    this.root.parent?.add(mesh)
    this.root.parent?.add(ring)
    this.telegraphs.push({ mesh, ring, timer: duration, total: duration, onDone, followPlayer, center: center.clone() })
  }

  update(dt: number, ctx: EnemyContext, events: BossEvent[]): void {
    this.animPhase += dt
    this.flash = Math.max(0, this.flash - dt * 3.5)
    this.updateTelegraphs(dt, ctx)

    if (this.dead) {
      this.deathTimer -= dt
      this.root.position.copy(this.position)
      if (this.deathTimer <= 0) this.finished = true
      return
    }
    this.stateTimer = Math.max(0, this.stateTimer - dt)
    this.attackCooldown = Math.max(0, this.attackCooldown - dt)
    for (const [id, value] of this.cooldowns) this.cooldowns.set(id, Math.max(0, value - dt))

    // Phase transitions.
    const phase = this.def.phases[Math.min(this.phaseIndex, this.def.phases.length - 1)]
    if (this.phaseIndex < this.def.phases.length - 1 && this.healthRatio <= this.def.phases[this.phaseIndex + 1].threshold) {
      this.phaseIndex += 1
      const next = this.def.phases[this.phaseIndex]
      this.state = 'stagger'
      this.stateTimer = 1.4
      events.push({ type: 'phase', index: this.phaseIndex, name: next.name, line: next.line })
      events.push({ type: 'roar' })
    }

    const player = ctx.playerPosition
    const toPlayer = new THREE.Vector3(player.x - this.position.x, 0, player.z - this.position.z)
    const distance = toPlayer.length()
    if (!ctx.playerDead && distance < 34) this.aggro = true

    const speed = 3.1 * phase.speed

    switch (this.state) {
      case 'idle': {
        if (this.aggro) this.state = 'chase'
        break
      }
      case 'chase': {
        if (distance > 4.5) {
          this.velocity.x = damp(this.velocity.x, (toPlayer.x / Math.max(0.001, distance)) * speed, 4, dt)
          this.velocity.z = damp(this.velocity.z, (toPlayer.z / Math.max(0.001, distance)) * speed, 4, dt)
        } else {
          this.velocity.x = damp(this.velocity.x, 0, 8, dt)
          this.velocity.z = damp(this.velocity.z, 0, 8, dt)
        }
        this.facing = dampAngle(this.facing, Math.atan2(-toPlayer.x, -toPlayer.z), 5, dt)
        if (this.attackCooldown <= 0) this.chooseAttack(phase.attacks, distance, ctx, events)
        break
      }
      case 'windup': {
        this.velocity.x = damp(this.velocity.x, 0, 8, dt)
        this.velocity.z = damp(this.velocity.z, 0, 8, dt)
        if (this.stateTimer <= 0) {
          this.executeAttack(events)
          this.state = 'recover'
          this.stateTimer = 0.7
          this.attackCooldown = 1.6 + Math.random() * 1.4
        }
        break
      }
      case 'recover': {
        if (this.chargeTimer > 0) {
          this.chargeTimer -= dt
          this.velocity.x = this.chargeDirection.x * 18
          this.velocity.z = this.chargeDirection.z * 18
        }
        if (this.stateTimer <= 0) this.state = 'chase'
        break
      }
      case 'stagger': {
        if (this.stateTimer <= 0) this.state = 'chase'
        break
      }
      case 'dead':
        break
    }

    this.position.x += this.velocity.x * dt
    this.position.z += this.velocity.z * dt
    this.position.y = ctx.groundAt(this.position.x, this.position.z, this.position.y)
    this.velocity.x = damp(this.velocity.x, 0, 5, dt)
    this.velocity.z = damp(this.velocity.z, 0, 5, dt)
    this.root.position.copy(this.position)
    this.root.rotation.y = this.facing
  }

  private chooseAttack(attackIds: string[], distance: number, ctx: EnemyContext, events: BossEvent[]): void {
    const available = this.def.attacks.filter(a => attackIds.includes(a.id) && (this.cooldowns.get(a.id) ?? 0) <= 0)
    if (!available.length) {
      this.attackCooldown = 0.6
      return
    }
    const attack = available[Math.floor(Math.random() * available.length)]
    this.pendingAttack = attack
    this.cooldowns.set(attack.id, attack.cooldown)
    this.state = 'windup'
    this.stateTimer = attack.windup
    const color = attack.element ? ELEMENTS[attack.element].color : '#ff6a6a'
    const target = ctx.playerPosition.clone()
    if (attack.kind === 'area' || attack.kind === 'impacto' || attack.kind === 'meteoro') {
      const radius = Math.max(2, attack.radius)
      this.telegraph(target, radius, attack.windup, color, () => undefined, attack.kind !== 'meteoro')
      events.push({ type: 'roar' })
    } else if (attack.kind === 'investida') {
      this.chargeDirection.set(target.x - this.position.x, 0, target.z - this.position.z).normalize()
      this.telegraph(target, 2.4, attack.windup, color, () => undefined)
    } else if (attack.kind === 'leque' || attack.kind === 'raio' || attack.kind === 'projetil' || attack.kind === 'varredura') {
      const dir = new THREE.Vector3(target.x - this.position.x, 0, target.z - this.position.z).normalize()
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(Math.tan(0.5) * attack.range * 0.5, attack.range, 4, 1, true),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
      )
      cone.rotation.x = -Math.PI / 2
      cone.position.set(this.position.x + dir.x * attack.range * 0.5, this.position.y + 0.1, this.position.z + dir.z * attack.range * 0.5)
      cone.rotation.z = Math.atan2(dir.x, dir.z)
      this.root.parent?.add(cone)
      this.telegraphs.push({
        mesh: cone,
        ring: cone,
        timer: attack.windup,
        total: attack.windup,
        onDone: () => undefined,
        followPlayer: false,
        center: this.position.clone(),
      })
    }
    void distance
  }

  private executeAttack(events: BossEvent[]): void {
    const attack = this.pendingAttack
    if (!attack) return
    this.pendingAttack = undefined
    const element = attack.element
    const origin = this.position.clone().setY(this.position.y + this.visual.height * 0.5)
    const dir = new THREE.Vector3(-Math.sin(this.facing), 0, -Math.cos(this.facing))
    switch (attack.kind) {
      case 'impacto':
      case 'area': {
        const center = this.position.clone()
        // The telegraph followed the player, so use its final centre.
        const last = this.telegraphs[this.telegraphs.length - 1]
        if (last) center.copy(last.center)
        events.push({ type: 'aoe', center, radius: Math.max(2.5, attack.radius), damage: attack.damage, element, name: attack.name })
        break
      }
      case 'meteoro': {
        for (let i = 0; i < 4; i += 1) {
          const offset = new THREE.Vector3((Math.random() - 0.5) * 16, 0, (Math.random() - 0.5) * 16)
          const center = this.position.clone().add(offset)
          events.push({ type: 'aoe', center, radius: 3.4, damage: attack.damage * 0.6, element, name: attack.name })
        }
        break
      }
      case 'varredura': {
        events.push({ type: 'cone', origin: this.position.clone(), direction: dir, range: attack.range, arc: 1.3, damage: attack.damage, element, name: attack.name })
        break
      }
      case 'projetil': {
        events.push({ type: 'projectile', from: origin, dir, speed: 22, damage: attack.damage, element, radius: 0.7 })
        break
      }
      case 'leque': {
        const count = attack.count ?? 5
        for (let i = 0; i < count; i += 1) {
          const spread = (i - (count - 1) / 2) * 0.18
          const rotated = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), spread)
          events.push({ type: 'projectile', from: origin, dir: rotated, speed: 20, damage: attack.damage * 0.7, element, radius: 0.5 })
        }
        break
      }
      case 'raio': {
        events.push({ type: 'cone', origin: this.position.clone(), direction: dir, range: attack.range, arc: 0.35, damage: attack.damage, element, name: attack.name })
        break
      }
      case 'investida': {
        this.chargeTimer = 0.8
        this.stateTimer = 0.9
        events.push({ type: 'cone', origin: this.position.clone(), direction: this.chargeDirection, range: attack.range, arc: 0.9, damage: attack.damage, element, name: attack.name })
        break
      }
      case 'invocacao': {
        events.push({ type: 'summon', enemyId: 'esqueleto-guerreiro', count: 3 })
        break
      }
    }
  }

  private updateTelegraphs(dt: number, ctx: EnemyContext): void {
    for (let i = this.telegraphs.length - 1; i >= 0; i -= 1) {
      const t = this.telegraphs[i]
      t.timer -= dt
      const progress = 1 - t.timer / t.total
      const material = t.mesh.material as THREE.MeshBasicMaterial
      material.opacity = 0.12 + Math.sin(progress * Math.PI * 6) * 0.08 + progress * 0.2
      if (t.ring !== t.mesh) {
        const ringMaterial = t.ring.material as THREE.MeshBasicMaterial
        ringMaterial.opacity = 0.5 + Math.sin(progress * Math.PI * 8) * 0.3
      }
      if (t.followPlayer) {
        t.center.copy(ctx.playerPosition).setY(ctx.playerPosition.y + 0.06)
        t.mesh.position.x = t.center.x
        t.mesh.position.z = t.center.z
        t.mesh.position.y = t.center.y
        if (t.ring !== t.mesh) {
          t.ring.position.x = t.center.x
          t.ring.position.z = t.center.z
        }
      }
      if (t.timer <= 0) {
        if (t.ring !== t.mesh) {
          t.mesh.removeFromParent()
          t.ring.removeFromParent()
        } else {
          t.mesh.removeFromParent()
        }
        t.mesh.geometry.dispose()
        ;(t.mesh.material as THREE.Material).dispose()
        if (t.ring !== t.mesh) {
          ;(t.ring.material as THREE.Material).dispose()
        }
        this.telegraphs.splice(i, 1)
      }
    }
  }

  render(dt: number, camera: THREE.Camera): void {
    const speed = Math.hypot(this.velocity.x, this.velocity.z)
    if (speed > 0.4) {
      const swing = Math.sin(this.animPhase * 4) * 0.5
      if (this.visual.legL) this.visual.legL.rotation.x = swing
      if (this.visual.legR) this.visual.legR.rotation.x = -swing
      if (this.visual.armL) this.visual.armL.rotation.x = -swing * 0.6
      if (this.visual.armR) this.visual.armR.rotation.x = swing * 0.6
    } else {
      this.visual.body.position.y = Math.sin(this.animPhase * 1.4) * 0.05
    }
    if (this.state === 'windup') {
      const t = this.stateTimer
      this.visual.body.rotation.x = -0.15 - Math.sin(this.animPhase * 12) * 0.05
      if (this.visual.armR) this.visual.armR.rotation.x = -1.6 + Math.sin(this.animPhase * 10) * 0.2
      void t
    } else {
      this.visual.body.rotation.x = damp(this.visual.body.rotation.x, 0, 6, dt)
    }
    const auraMaterial = this.aura.material as THREE.MeshBasicMaterial
    auraMaterial.opacity = 0.1 + Math.sin(this.animPhase * 2) * 0.05 + (this.state === 'windup' ? 0.15 : 0)
    this.rune.rotation.z += dt * 0.6
    for (const material of this.visual.materials) {
      if (material.userData.baseEmissive === undefined) material.userData.baseEmissive = material.emissive.getHexString()
      if (material.userData.baseIntensity === undefined) material.userData.baseIntensity = material.emissiveIntensity
      material.emissive.set(this.flash > 0 ? '#ffffff' : `#${material.userData.baseEmissive as string}`)
      material.emissiveIntensity = this.flash > 0 ? 1.8 : (material.userData.baseIntensity as number)
    }
    if (this.dead) {
      const t = clamp(1 - this.deathTimer / 3, 0, 1)
      this.visual.root.rotation.x = -t * Math.PI * 0.45
      this.visual.root.position.y = -t * this.visual.height * 0.3
      for (const material of this.visual.materials) {
        material.transparent = true
        material.opacity = 1 - t * 0.85
      }
      auraMaterial.opacity = 0
    }
    void camera
  }

  dispose(): void {
    this.clearTelegraphs()
    this.root.removeFromParent()
    disposeEnemyVisual(this.visual)
    this.aura.geometry.dispose()
    ;(this.aura.material as THREE.Material).dispose()
    this.rune.geometry.dispose()
    ;(this.rune.material as THREE.Material).dispose()
  }
}
