import * as THREE from 'three'
import type { ElementId, EnemyType } from '../data/types'
import { clamp, damp, dampAngle } from '../core/math'
import type { Collider } from '../world/collision'
import { resolveCircle } from '../world/collision'
import { buildEnemyVisual, disposeEnemyVisual, type EnemyVisual } from './enemyModels'
import { ExternalCharacter, EXTERNAL_CHARACTER_URLS, type ExternalAnimation } from './externalModels'
import { damageAfterDefense, elementalMultiplier, type StatusKind } from '../combat/damage'

export type EnemyEvent =
  | { type: 'melee'; damage: number; range: number; arc: number; element?: ElementId; heavy: boolean }
  | { type: 'projectile'; from: THREE.Vector3; dir: THREE.Vector3; speed: number; damage: number; element?: ElementId; radius: number }
  | { type: 'summon'; enemyId: string; count: number }
  | { type: 'death'; enemy: Enemy }

export type EnemyContext = {
  playerPosition: THREE.Vector3
  playerDead: boolean
  playerStealth: number
  groundAt: (x: number, z: number, feetY: number) => number
  collidersNear: (x: number, z: number) => readonly Collider[]
  night: number
  inCombat: boolean
}

export type EnemySpawn = { def: EnemyType; level: number; x: number; z: number; elite?: boolean; homeX?: number; homeZ?: number }

const STATE_LABEL: Record<string, string> = {
  idle: 'Parado',
  patrol: 'Patrulhando',
  chase: 'Perseguindo',
  windup: 'Preparando ataque',
  attack: 'Atacando',
  recover: 'Recuperando',
  stagger: 'Atordoado',
  dead: 'Morto',
}

/** A single living creature with a small but readable state-machine AI. */
export class Enemy {
  readonly def: EnemyType
  readonly level: number
  readonly root = new THREE.Group()
  readonly position = new THREE.Vector3()
  readonly velocity = new THREE.Vector3()
  readonly home: THREE.Vector3
  facing = 0
  health: number
  readonly maxHealth: number
  readonly damage: number
  readonly defense: number
  readonly xp: number
  readonly elite: boolean
  state: 'idle' | 'patrol' | 'chase' | 'windup' | 'attack' | 'recover' | 'stagger' | 'dead' = 'idle'
  aggro = false
  dead = false
  /** Set when the death animation finished and the game should remove it. */
  finished = false
  /** Set by the game once kill rewards were granted. */
  counted = false
  private readonly visual: EnemyVisual
  private external?: ExternalCharacter
  private readonly statuses = new Map<StatusKind, { seconds: number; power: number }>()
  private stateTimer = 0
  private attackCooldown = 0
  private wanderTimer = 0
  private wanderTarget = new THREE.Vector3()
  private lungeTimer = 0
  private flash = 0
  private deathTimer = 0
  private readonly bar: THREE.Group
  private readonly barFill: THREE.Mesh
  private readonly barBg: THREE.Mesh
  private animPhase = Math.random() * Math.PI * 2
  private summonTimer = 12

  constructor(spawn: EnemySpawn) {
    this.def = spawn.def
    this.level = Math.max(1, spawn.level)
    this.elite = spawn.elite === true
    const levelScale = 1 + (this.level - 1) * 0.16
    const eliteScale = this.elite ? 1.9 : 1
    this.maxHealth = Math.round(this.def.health * levelScale * eliteScale)
    this.health = this.maxHealth
    this.damage = this.def.damage * (1 + (this.level - 1) * 0.13) * (this.elite ? 1.35 : 1)
    this.defense = this.def.defense + this.level * 0.35
    this.xp = Math.round(this.def.xp * (1 + (this.level - 1) * 0.14) * (this.elite ? 2.4 : 1))
    this.position.set(spawn.x, 0, spawn.z)
    this.home = new THREE.Vector3(spawn.homeX ?? spawn.x, 0, spawn.homeZ ?? spawn.z)
    const scale = this.def.scale * (this.elite ? 1.35 : 1)
    this.visual = buildEnemyVisual(this.def.model, this.def.colors, scale)
    this.root.add(this.visual.root)
    const externalEnemyUrl = this.def.model === 'cavaleiro' ? EXTERNAL_CHARACTER_URLS.knight
      : this.def.model === 'esqueleto' || this.def.model === 'mumia' ? EXTERNAL_CHARACTER_URLS.mummy
      : this.def.model === 'goblin' || this.def.model === 'diabrete' ? EXTERNAL_CHARACTER_URLS.orc
      : this.def.model === 'golem' || this.def.model === 'gigante' || this.def.model === 'troll' ? EXTERNAL_CHARACTER_URLS.brute
      : this.def.model === 'espectro' ? EXTERNAL_CHARACTER_URLS.ghost
      : this.def.model === 'yeti' ? EXTERNAL_CHARACTER_URLS.werewolf
      : this.def.model === 'elemental' ? EXTERNAL_CHARACTER_URLS.witch : undefined
    if (externalEnemyUrl) {
      void ExternalCharacter.load(externalEnemyUrl, this.visual.height * scale).then(model => {
        if (this.finished) { model.dispose(); return }
        this.external = model
        this.visual.root.visible = false
        this.root.add(model.root)
      }).catch(error => console.warn('Não foi possível carregar inimigo 3D externo:', error))
    }
    this.root.position.copy(this.position)

    const barWidth = Math.max(0.9, this.visual.radius * 1.9)
    this.barBg = new THREE.Mesh(new THREE.PlaneGeometry(barWidth, 0.13), new THREE.MeshBasicMaterial({ color: '#120f18', transparent: true, opacity: 0.85, depthTest: false, depthWrite: false }))
    this.barFill = new THREE.Mesh(new THREE.PlaneGeometry(barWidth - 0.04, 0.08), new THREE.MeshBasicMaterial({ color: this.elite ? '#ffb347' : '#ff5d6c', depthTest: false, depthWrite: false }))
    this.barFill.position.z = 0.001
    this.bar = new THREE.Group()
    this.bar.add(this.barBg, this.barFill)
    this.bar.position.y = this.visual.height + 0.5
    this.bar.visible = false
    this.bar.renderOrder = 10
    this.root.add(this.bar)
    this.wanderTarget.copy(this.position)
  }

  get alive(): boolean {
    return !this.dead
  }

  get radius(): number {
    return this.visual.radius
  }

  get height(): number {
    return this.visual.height
  }

  get displayName(): string {
    return this.elite ? `${this.def.name} Ancestral` : this.def.name
  }

  get statusLabel(): string {
    if (this.dead) return 'Morto'
    const active = [...this.statuses.keys()]
    if (active.length) return active.map(s => s[0].toUpperCase() + s.slice(1)).join(', ')
    return STATE_LABEL[this.state]
  }

  hasStatus(kind: StatusKind): boolean {
    return this.statuses.has(kind)
  }

  private setStatus(kind: StatusKind, seconds: number, power = 1): void {
    const existing = this.statuses.get(kind)
    this.statuses.set(kind, { seconds: Math.max(seconds, existing?.seconds ?? 0), power: Math.max(power, existing?.power ?? 0) })
  }

  /** Apply a hit; returns the damage actually dealt and whether it was critical or lethal. */
  takeDamage(raw: number, options: { element?: ElementId; crit?: boolean; knockback?: number; from?: THREE.Vector3; ignoreDefense?: boolean } = {}): { amount: number; crit: boolean; killed: boolean } {
    if (this.dead) return { amount: 0, crit: false, killed: false }
    const resist = elementalMultiplier(options.element, this.def.element)
    let amount = options.ignoreDefense ? raw : damageAfterDefense(raw, this.defense)
    amount *= resist
    if (this.hasStatus('enfraquecido')) amount *= 1.1
    if (this.hasStatus('congelado')) amount *= 1.25
    const crit = options.crit === true
    if (crit) amount *= 1.85
    amount = Math.max(1, Math.round(amount))
    this.health = Math.max(0, this.health - amount)
    this.flash = 1
    this.aggro = true
    if (options.element) {
      const statusForElement: Record<ElementId, StatusKind | undefined> = { fogo: 'queimando', gelo: 'congelado', raio: 'eletrificado', terra: 'lento', vento: undefined, sombra: 'enfraquecido' }
      const status = statusForElement[options.element]
      if (status) this.setStatus(status, status === 'congelado' ? 1.6 : 4, 1)
      if (this.hasStatus('molhado') && options.element === 'raio') this.setStatus('eletrificado', 3, 1.5)
    }
    if (options.knockback && options.from) {
      const away = new THREE.Vector3(this.position.x - options.from.x, 0, this.position.z - options.from.z)
      if (away.lengthSq() < 1e-4) away.set(1, 0, 0)
      away.normalize().multiplyScalar(options.knockback * (this.def.behavior === 'bruto' ? 0.45 : 1))
      this.velocity.x += away.x
      this.velocity.z += away.z
    }
    if (crit || options.knockback && options.knockback > 2) {
      this.state = 'stagger'
      this.stateTimer = 0.45
    }
    const killed = this.health <= 0
    if (killed) {
      this.dead = true
      this.state = 'dead'
      this.deathTimer = 1.8
      this.bar.visible = false
    }
    return { amount, crit, killed }
  }

  applyStatus(kind: StatusKind, seconds: number, power = 1): void {
    this.setStatus(kind, seconds, power)
  }

  /** One fixed AI step. */
  update(dt: number, ctx: EnemyContext, events: EnemyEvent[]): void {
    if (this.dead) {
      this.deathTimer -= dt
      this.root.position.copy(this.position)
      if (this.deathTimer <= 0) this.finished = true
      return
    }
    this.stateTimer = Math.max(0, this.stateTimer - dt)
    this.attackCooldown = Math.max(0, this.attackCooldown - dt)
    this.lungeTimer = Math.max(0, this.lungeTimer - dt)
    this.flash = Math.max(0, this.flash - dt * 4)
    this.animPhase += dt * 4

    // Status damage over time.
    for (const [kind, status] of this.statuses) {
      status.seconds -= dt
      if (status.seconds <= 0) {
        this.statuses.delete(kind)
        continue
      }
      if (kind === 'queimando') this.applyDamageOverTime(dt, 4 * status.power, events)
      if (kind === 'eletrificado') this.applyDamageOverTime(dt, 6 * status.power, events)
      if (kind === 'sangrando') this.applyDamageOverTime(dt, 3.5 * status.power, events)
    }
    if (this.dead) return

    const frozen = this.hasStatus('congelado')
    const slowed = this.hasStatus('lento') ? 0.55 : 1
    const speed = this.def.speed * slowed * (frozen ? 0 : 1) * (this.state === 'stagger' ? 0 : 1)

    const player = ctx.playerPosition
    const toPlayer = new THREE.Vector3(player.x - this.position.x, 0, player.z - this.position.z)
    const distance = toPlayer.length()
    const aggroRange = this.def.aggroRange * (this.def.nocturnal && ctx.night > 0.5 ? 1.35 : 1) * (1 - ctx.playerStealth * 0.6)
    if (!ctx.playerDead && distance < aggroRange) this.aggro = true
    if (ctx.playerDead) this.aggro = false
    if (this.aggro && distance > 46) this.aggro = false

    switch (this.state) {
      case 'idle': {
        if (this.aggro) this.state = 'chase'
        else {
          this.wanderTimer -= dt
          if (this.wanderTimer <= 0) {
            this.wanderTimer = 3 + Math.random() * 5
            const angle = Math.random() * Math.PI * 2
            const radius = 3 + Math.random() * 7
            this.wanderTarget.set(this.home.x + Math.cos(angle) * radius, 0, this.home.z + Math.sin(angle) * radius)
            this.state = 'patrol'
          }
        }
        break
      }
      case 'patrol': {
        if (this.aggro) {
          this.state = 'chase'
          break
        }
        const toTarget = new THREE.Vector3(this.wanderTarget.x - this.position.x, 0, this.wanderTarget.z - this.position.z)
        if (toTarget.length() < 1.2 || this.wanderTimer <= 0) {
          this.state = 'idle'
          this.wanderTimer = 2 + Math.random() * 4
          break
        }
        this.moveTowards(toTarget.normalize(), speed * 0.35, dt, ctx)
        break
      }
      case 'chase': {
        if (!this.aggro) {
          this.state = 'idle'
          break
        }
        const ranged = this.def.behavior === 'distancia' || this.def.behavior === 'conjurador'
        const ideal = ranged ? Math.max(7, this.def.attackRange * 0.75) : this.def.attackRange * 0.82
        if (distance > ideal * 1.05) this.moveTowards(toPlayer.clone().normalize(), speed, dt, ctx)
        else if (ranged && distance < ideal * 0.6) this.moveTowards(toPlayer.clone().normalize().negate(), speed * 0.7, dt, ctx)
        else this.velocity.x = damp(this.velocity.x, 0, 8, dt)
        this.velocity.z = damp(this.velocity.z, 0, 8, dt)
        if (distance < this.def.attackRange && this.attackCooldown <= 0) {
          this.state = 'windup'
          this.stateTimer = this.def.behavior === 'bruto' ? 0.95 : this.def.behavior === 'assassino' ? 0.4 : 0.6
        }
        if (this.def.behavior === 'invocador') {
          this.summonTimer -= dt
          if (this.summonTimer <= 0) {
            this.summonTimer = 14
            events.push({ type: 'summon', enemyId: 'esqueleto-guerreiro', count: 2 })
          }
        }
        break
      }
      case 'windup': {
        this.velocity.x = damp(this.velocity.x, 0, 10, dt)
        this.velocity.z = damp(this.velocity.z, 0, 10, dt)
        this.facing = dampAngle(this.facing, Math.atan2(-toPlayer.x, -toPlayer.z), 8, dt)
        if (this.stateTimer <= 0) {
          this.state = 'attack'
          this.stateTimer = 0.22
          this.lungeTimer = 0.22
          const element = this.def.element
          if (this.def.behavior === 'distancia' || this.def.behavior === 'conjurador') {
            const dir = new THREE.Vector3(player.x - this.position.x, (player.y + 1.1) - (this.position.y + this.height * 0.55), player.z - this.position.z).normalize()
            events.push({
              type: 'projectile',
              from: new THREE.Vector3(this.position.x, this.position.y + this.height * 0.55, this.position.z).addScaledVector(dir, this.radius + 0.2),
              dir,
              speed: this.def.behavior === 'conjurador' ? 18 : 26,
              damage: this.damage,
              element,
              radius: 0.4,
            })
          } else {
            events.push({ type: 'melee', damage: this.damage, range: this.def.attackRange + 0.6, arc: this.def.behavior === 'bruto' ? 1.5 : 1.0, element, heavy: this.def.behavior === 'bruto' })
          }
          this.attackCooldown = this.def.attackCooldown
        }
        break
      }
      case 'attack': {
        if (this.stateTimer <= 0) {
          this.state = 'recover'
          this.stateTimer = 0.3
        }
        break
      }
      case 'recover': {
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

    // Integrate movement with terrain and collider avoidance.
    const colliders = ctx.collidersNear(this.position.x, this.position.z)
    let nx = this.position.x + this.velocity.x * dt
    let nz = this.position.z + this.velocity.z * dt
    for (const collider of colliders) {
      const resolved = resolveCircle(nx, nz, this.radius * 0.8, collider, this.position.y, this.position.y + this.height)
      if (resolved) {
        nx = resolved.x
        nz = resolved.z
      }
    }
    const ground = ctx.groundAt(nx, nz, this.position.y)
    const flying = this.def.behavior === 'voador'
    if (!flying && ground < -0.4 && this.def.biomes.every(b => b !== 'oceano' && b !== 'praia')) {
      // Land creatures avoid deep water.
      nx = this.position.x
      nz = this.position.z
    }
    this.position.x = nx
    this.position.z = nz
    if (flying) {
      const hover = ground + 2.4 + Math.sin(this.animPhase * 0.6) * 0.35
      this.position.y = damp(this.position.y, hover, 4, dt)
    } else {
      this.position.y = ground
    }
    this.velocity.x = damp(this.velocity.x, 0, 6, dt)
    this.velocity.z = damp(this.velocity.z, 0, 6, dt)

    const moving = Math.hypot(this.velocity.x, this.velocity.z) > 0.2
    if (moving) this.facing = dampAngle(this.facing, Math.atan2(-this.velocity.x, -this.velocity.z), 8, dt)
    this.root.position.copy(this.position)
    this.root.rotation.y = this.facing
    this.bar.visible = this.aggro && !this.dead
  }

  private applyDamageOverTime(dt: number, dps: number, events: EnemyEvent[]): void {
    const amount = dps * dt
    this.health = Math.max(0, this.health - amount)
    if (this.health <= 0 && !this.dead) {
      this.dead = true
      this.state = 'dead'
      this.deathTimer = 1.8
      this.bar.visible = false
      events.push({ type: 'death', enemy: this })
    }
  }

  private moveTowards(direction: THREE.Vector3, speed: number, dt: number, ctx: EnemyContext): void {
    const target = direction.multiplyScalar(speed)
    this.velocity.x = damp(this.velocity.x, target.x, 6, dt)
    this.velocity.z = damp(this.velocity.z, target.z, 6, dt)
    if (this.def.behavior === 'voador') {
      this.position.y += Math.sin(this.animPhase) * 0.01
    }
    void ctx
  }

  /** Visual update: billboard health bar, limb swings, hit flash and death fade. */
  render(dt: number, camera: THREE.Camera): void {
    const visual = this.visual
    const speed = Math.hypot(this.velocity.x, this.velocity.z)
    const nextMode: ExternalAnimation = this.dead ? 'death'
      : this.state === 'attack' || this.state === 'windup' ? 'attack'
      : this.state === 'stagger' ? 'hit'
      : speed > 3 ? 'run' : speed > 0.4 ? 'walk' : 'idle'
    this.external?.update(dt, nextMode)
    const moving = speed > 0.4 && !this.dead
    if (moving) {
      const swing = Math.sin(this.animPhase * 2.2) * Math.min(0.9, speed * 0.22)
      if (visual.legL) visual.legL.rotation.x = swing
      if (visual.legR) visual.legR.rotation.x = -swing
      if (visual.armL) visual.armL.rotation.x = -swing * 0.7
      if (visual.armR) visual.armR.rotation.x = swing * 0.7
      visual.body.position.y = Math.abs(Math.sin(this.animPhase * 2.2)) * 0.06
    } else if (!this.dead) {
      visual.body.position.y = Math.sin(this.animPhase) * 0.03
      if (visual.armL) visual.armL.rotation.x = damp(visual.armL.rotation.x, 0, 6, dt)
      if (visual.armR) visual.armR.rotation.x = damp(visual.armR.rotation.x, 0, 6, dt)
    }
    if (this.lungeTimer > 0) {
      const lunge = this.lungeTimer / 0.22
      visual.body.position.z = -Math.sin(lunge * Math.PI) * 0.5
      if (visual.armR) visual.armR.rotation.x = -2.2 * Math.sin(lunge * Math.PI)
    } else {
      visual.body.position.z = damp(visual.body.position.z, 0, 10, dt)
    }
    for (const wing of visual.wings) {
      wing.rotation.z = Math.sin(this.animPhase * 3) * 0.45
    }
    // Hit flash and status tint.
    const burning = this.statuses.has('queimando')
    const frozen = this.statuses.has('congelado')
    for (const material of visual.materials) {
      const baseEmissive = material.userData.baseEmissive as string | undefined
      if (baseEmissive === undefined) material.userData.baseEmissive = material.emissive.getHexString()
      const base = `#${(material.userData.baseEmissive as string) ?? '000000'}`
      material.emissive.set(this.flash > 0 ? '#ffffff' : frozen ? '#7fd8ff' : burning ? '#ff6a3d' : base)
      material.emissiveIntensity = this.flash > 0 ? 1.6 : frozen || burning ? 0.7 : material.userData.baseIntensity ?? 0
      if (material.userData.baseIntensity === undefined) material.userData.baseIntensity = material.emissiveIntensity
    }
    if (this.dead) {
      const t = clamp(1 - this.deathTimer / 1.8, 0, 1)
      this.visual.root.rotation.x = -t * Math.PI * 0.5
      this.visual.root.position.y = -t * this.height * 0.35
      for (const material of visual.materials) {
        material.transparent = true
        material.opacity = 1 - t * 0.9
      }
    }
    this.bar.quaternion.copy(camera.quaternion)
    const ratio = clamp(this.health / this.maxHealth, 0, 1)
    this.barFill.scale.x = Math.max(0.001, ratio)
    this.barFill.position.x = -(1 - ratio) * (this.barBg.geometry as THREE.PlaneGeometry).parameters.width / 2
  }

  dispose(): void {
    this.external?.dispose()
    this.root.removeFromParent()
    disposeEnemyVisual(this.visual)
    this.barBg.geometry.dispose()
    this.barFill.geometry.dispose()
    ;(this.barBg.material as THREE.Material).dispose()
    ;(this.barFill.material as THREE.Material).dispose()
  }
}
