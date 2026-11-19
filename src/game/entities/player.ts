import * as THREE from 'three'
import type { ElementId, WeaponKind } from '../data/types'
import { clamp, damp, dampAngle } from '../core/math'
import type { Collider } from '../world/collision'
import { resolveCircle } from '../world/collision'
import type { DerivedStats } from '../systems/stats'
import { CharacterModel, type AnimMode, type AnimState, type Appearance } from './character'
import { characterModelUrlFor } from './characterAssets'
import { DEFAULT_CHARACTER_PROFILE, parseCharacterProfile, type CharacterProfile } from '../data/characterProfile'
import { attackDuration, comboMultiplier, weaponProfile, type WeaponProfile } from '../combat/weapons'
import type { AbilityDef } from '../combat/abilities'

export type PlayerIntent = {
  moveX: number
  moveY: number
  sprint: boolean
  jumpPressed: boolean
  jumpHeld: boolean
  rollPressed: boolean
  attackPressed: boolean
  attackHeld: boolean
  blockHeld: boolean
}

export type AttackWindow = {
  reach: number
  arc: number
  multiplier: number
  charged: boolean
  knockback: number
  ranged: WeaponProfile['ranged']
  weapon: WeaponKind
}

export type PlayerEvent =
  | { type: 'jump' }
  | { type: 'land'; impact: number }
  | { type: 'roll' }
  | { type: 'swing'; charged: boolean }
  | { type: 'attack'; window: AttackWindow; combo: number }
  | { type: 'cast'; charged: boolean }
  | { type: 'hurt'; amount: number }
  | { type: 'die' }
  | { type: 'footstep'; water: boolean }
  | { type: 'swim' }
  | { type: 'glide' }
  | { type: 'climb' }
  | { type: 'parry' }

export type PlayerBuff = {
  id: string
  name: string
  seconds: number
  defenseMult: number
  speedMult: number
  critBonus: number
  stealthBonus: number
}

export type PlayerWorld = {
  groundAt: (x: number, z: number, feetY: number) => number
  collidersNear: (x: number, z: number) => readonly Collider[]
  isWater: (x: number, z: number) => boolean
  slopeAt: (x: number, z: number) => number
}

const RADIUS = 0.45
const STEP_HEIGHT = 0.75
const GRAVITY = -25
const WATER_LEVEL = 0

export class Player {
  readonly model: CharacterModel
  readonly root = new THREE.Group()
  readonly position = new THREE.Vector3()
  readonly velocity = new THREE.Vector3()
  readonly safe = new THREE.Vector3()
  facing = 0
  grounded = false
  mode: 'idle' | 'move' | 'attack' | 'roll' | 'cast' | 'hurt' | 'dead' = 'idle'
  health = 100
  mana = 60
  stamina = 100
  stats: DerivedStats
  weapon: WeaponKind = 'espada'
  element: ElementId = 'fogo'
  readonly buffs: PlayerBuff[] = []
  readonly cooldowns = new Map<string, number>()
  invulnerable = 0
  blocking = false
  parryWindow = 0
  gliding = false
  swimming = false
  climbing = false
  sprinting = false
  inWater = false
  lastDamageAt = -100
  lastCombatAt = -100
  kills = 0
  deaths = 0
  private actionTimer = 0
  private actionDuration = 0
  private comboIndex = 0
  private comboWindow = 0
  private chargeTime = 0
  private hitEmitted = false
  private coyote = 0
  private jumpBuffer = 0
  private staminaDelay = 0
  private manaDelay = 0
  private footstep = 0
  private safeTimer = 0
  private rollDirection = new THREE.Vector3()
  private chargedAttack = false
  private animTime = 0
  private spawnPoint = new THREE.Vector3()
  private characterProfile: CharacterProfile

  constructor(
    private readonly world: PlayerWorld,
    spawn: THREE.Vector3,
    stats: DerivedStats,
    appearance?: Partial<Appearance>,
    profile: CharacterProfile = DEFAULT_CHARACTER_PROFILE,
  ) {
    this.stats = stats
    this.characterProfile = parseCharacterProfile(profile)
    this.model = new CharacterModel(appearance, characterModelUrlFor(this.characterProfile.modelId), Math.PI)
    this.model.setAuraColor(this.characterProfile.auraColor)
    this.root.add(this.model.root)
    this.position.copy(spawn)
    this.root.position.copy(spawn)
    this.spawnPoint.copy(spawn)
    this.safe.copy(spawn)
    this.health = stats.maxHealth
    this.mana = stats.maxMana
    this.stamina = stats.maxStamina
    this.model.setEquipment({ weapon: 'espada' })
  }

  get x(): number {
    return this.position.x
  }

  get z(): number {
    return this.position.z
  }

  get dead(): boolean {
    return this.mode === 'dead'
  }

  get maxHealth(): number {
    return this.stats.maxHealth
  }

  get healthRatio(): number {
    return clamp(this.health / this.stats.maxHealth, 0, 1)
  }

  get manaRatio(): number {
    return clamp(this.mana / this.stats.maxMana, 0, 1)
  }

  get staminaRatio(): number {
    return clamp(this.stamina / this.stats.maxStamina, 0, 1)
  }

  get weaponProfile(): WeaponProfile {
    return weaponProfile(this.weapon)
  }

  /** Base stats adjusted by temporary buffs. */
  get effective(): DerivedStats {
    let defenseMult = 1
    let speedMult = 1
    let crit = this.stats.critChance
    let stealth = this.stats.stealth
    for (const buff of this.buffs) {
      defenseMult += buff.defenseMult
      speedMult += buff.speedMult
      crit += buff.critBonus
      stealth += buff.stealthBonus
    }
    return {
      ...this.stats,
      defense: this.stats.defense * defenseMult,
      moveSpeed: this.stats.moveSpeed * speedMult,
      critChance: clamp(crit, 0, 0.95),
      stealth: clamp(stealth, 0, 0.95),
    }
  }

  setElement(element: ElementId): void {
    this.element = element
  }

  cooldownLeft(id: string): number {
    return this.cooldowns.get(id) ?? 0
  }

  startCooldown(id: string, seconds: number): void {
    this.cooldowns.set(id, seconds)
  }

  applyBuff(buff: PlayerBuff): void {
    const existing = this.buffs.find(b => b.id === buff.id)
    if (existing) {
      existing.seconds = Math.max(existing.seconds, buff.seconds)
      return
    }
    this.buffs.push({ ...buff })
  }

  /** Check whether an ability can be used right now; returns an error message or null. */
  canCast(ability: AbilityDef): string | null {
    if (this.dead) return 'Você está caído.'
    if (this.mode === 'attack' || this.mode === 'roll' || this.mode === 'cast' || this.mode === 'hurt') return 'Ação em andamento.'
    if (this.cooldownLeft(ability.id) > 0) return `Recarga: ${this.cooldownLeft(ability.id).toFixed(1)}s`
    if (this.mana < ability.mana) return 'Mana insuficiente.'
    return null
  }

  /** Spend resources and lock the character into a cast animation. */
  beginCast(ability: AbilityDef): void {
    this.mana = Math.max(0, this.mana - ability.mana)
    this.manaDelay = 2.4
    this.cooldowns.set(ability.id, ability.cooldown)
    this.lastCombatAt = this.animTime
    this.startCast(ability.kind === 'buff' ? 0.4 : 0.45)
    if (ability.kind === 'mobilidade') {
      this.invulnerable = Math.max(this.invulnerable, 0.75)
      const forward = new THREE.Vector3(-Math.sin(this.facing), 0, -Math.cos(this.facing))
      this.velocity.x = forward.x * 22
      this.velocity.z = forward.z * 22
    }
    if (ability.kind === 'buff') {
      this.applyBuff({
        id: ability.id,
        name: ability.name,
        seconds: ability.duration,
        defenseMult: ability.defenseBonus,
        speedMult: ability.speedBonus,
        critBonus: ability.critBonus,
        stealthBonus: ability.stealthBonus,
      })
    }
  }

  get inCombat(): boolean {
    return this.animTime - this.lastCombatAt < 6
  }

  /** Apply new derived stats, preserving current resource ratios. */
  setStats(stats: DerivedStats): void {
    const healthRatio = this.health / Math.max(1, this.stats.maxHealth)
    const manaRatio = this.mana / Math.max(1, this.stats.maxMana)
    const staminaRatio = this.stamina / Math.max(1, this.stats.maxStamina)
    this.stats = stats
    this.health = clamp(healthRatio * stats.maxHealth, 1, stats.maxHealth)
    this.mana = manaRatio * stats.maxMana
    this.stamina = staminaRatio * stats.maxStamina
  }

  setWeapon(kind: WeaponKind): void {
    this.weapon = kind
    this.model.setEquipment({ weapon: kind, rarity: 'raro' })
  }

  setCharacterProfile(profile: CharacterProfile): void {
    const safeProfile = parseCharacterProfile(profile)
    const modelChanged = safeProfile.modelId !== this.characterProfile.modelId
    this.characterProfile = safeProfile
    this.model.setAuraColor(safeProfile.auraColor)
    if (modelChanged) this.model.setKayKitModel(safeProfile.modelId)
  }

  teleport(to: THREE.Vector3): void {
    this.position.copy(to)
    this.velocity.set(0, 0, 0)
    this.mode = 'idle'
    this.actionTimer = 0
    this.grounded = false
    this.root.position.copy(to)
  }

  respawn(): void {
    this.health = this.stats.maxHealth
    this.mana = this.stats.maxMana
    this.stamina = this.stats.maxStamina
    this.mode = 'idle'
    this.invulnerable = 2
    this.teleport(this.safe.lengthSq() > 0 ? this.safe : this.spawnPoint)
  }

  /** One fixed simulation step. */
  step(dt: number, intent: PlayerIntent, cameraYaw: number, events: PlayerEvent[]): void {
    this.animTime += dt
    this.invulnerable = Math.max(0, this.invulnerable - dt)
    this.parryWindow = Math.max(0, this.parryWindow - dt)
    this.comboWindow = Math.max(0, this.comboWindow - dt)
    this.coyote = Math.max(0, this.coyote - dt)
    for (const [id, seconds] of this.cooldowns) {
      if (seconds - dt <= 0) this.cooldowns.delete(id)
      else this.cooldowns.set(id, seconds - dt)
    }
    for (let i = this.buffs.length - 1; i >= 0; i -= 1) {
      this.buffs[i].seconds -= dt
      if (this.buffs[i].seconds <= 0) this.buffs.splice(i, 1)
    }
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt)
    this.actionTimer = Math.max(0, this.actionTimer - dt)

    if (this.mode === 'dead') {
      this.velocity.x = damp(this.velocity.x, 0, 8, dt)
      this.velocity.z = damp(this.velocity.z, 0, 8, dt)
      this.velocity.y = Math.max(-40, this.velocity.y + GRAVITY * dt)
      this.position.y = Math.max(this.world.groundAt(this.position.x, this.position.z, this.position.y), this.position.y + this.velocity.y * dt)
      this.root.position.copy(this.position)
      return
    }

    // Resource regeneration.
    this.staminaDelay = Math.max(0, this.staminaDelay - dt)
    this.manaDelay = Math.max(0, this.manaDelay - dt)
    if (this.staminaDelay <= 0 && !this.sprinting && !this.climbing && !this.gliding) {
      this.stamina = Math.min(this.stats.maxStamina, this.stamina + 16 * dt)
    }
    if (this.manaDelay <= 0) this.mana = Math.min(this.stats.maxMana, this.mana + (2.4 + this.stats.maxMana * 0.004) * dt)
    if (this.animTime - this.lastDamageAt > 7) this.health = Math.min(this.stats.maxHealth, this.health + 0.5 * dt)

    const wish = this.wishDirection(intent, cameraYaw)
    const wishLen = Math.min(1, Math.hypot(intent.moveX, intent.moveY))

    if (intent.jumpPressed) this.jumpBuffer = 0.16

    // Start actions.
    if (this.mode === 'attack' && this.actionTimer <= 0) {
      this.mode = 'idle'
      this.comboWindow = 0.55
    }
    if (this.mode === 'hurt' && this.actionTimer <= 0) this.mode = 'idle'
    if (this.mode === 'cast' && this.actionTimer <= 0) this.mode = 'idle'
    if (this.mode === 'roll' && this.actionTimer <= 0) this.mode = 'idle'

    const busy = this.mode === 'attack' || this.mode === 'roll' || this.mode === 'cast' || this.mode === 'hurt'
    this.blocking = intent.blockHeld && !busy && this.grounded && this.stamina > 1

    if (intent.rollPressed && !busy && this.grounded && this.stamina >= 18) {
      this.startRoll(wish, wishLen, events)
    } else if (intent.attackPressed && this.mode !== 'roll' && this.mode !== 'hurt' && this.stamina >= this.weaponProfile.stamina) {
      this.startAttack(false, events)
    }

    // Charged attack: hold to charge, release to unleash.
    if (intent.attackHeld && !busy && this.grounded) {
      this.chargeTime = Math.min(1.2, this.chargeTime + dt)
      if (this.chargeTime > 0.4) this.mode = this.mode === 'idle' ? 'attack' : this.mode
    } else if (!intent.attackHeld && this.chargeTime > 0) {
      if (this.chargeTime > 0.4 && !busy && this.stamina >= this.weaponProfile.stamina) this.startAttack(true, events)
      this.chargeTime = 0
    }

    // Roll movement overrides normal locomotion.
    if (this.mode === 'roll') {
      const t = 1 - this.actionTimer / Math.max(0.01, this.actionDuration)
      const speed = 11 * (1 - t * 0.55)
      this.velocity.x = this.rollDirection.x * speed
      this.velocity.z = this.rollDirection.z * speed
    } else if (this.mode === 'attack') {
      const lock = this.weaponProfile.id === 'espadao' || this.weaponProfile.id === 'machado' ? 0.1 : 0.3
      const target = wish.clone().multiplyScalar(this.stats.moveSpeed * lock)
      this.velocity.x = damp(this.velocity.x, target.x, 8, dt)
      this.velocity.z = damp(this.velocity.z, target.z, 8, dt)
    } else if (this.mode === 'hurt') {
      this.velocity.x = damp(this.velocity.x, 0, 6, dt)
      this.velocity.z = damp(this.velocity.z, 0, 6, dt)
    } else {
      this.locomotion(dt, wish, wishLen, intent, events)
    }

    // Facing: lock during attacks unless steering lightly.
    if (this.mode === 'attack') {
      if (wishLen > 0.4) this.facing = dampAngle(this.facing, Math.atan2(-wish.x, -wish.z), 6, dt)
    } else if (this.mode === 'roll') {
      this.facing = Math.atan2(-this.rollDirection.x, -this.rollDirection.z)
    } else if (wishLen > 0.15) {
      this.facing = dampAngle(this.facing, Math.atan2(-wish.x, -wish.z), 14, dt)
    }

    this.integrate(dt, events)
    this.updateActionTimers(dt, events)

    // Footsteps.
    if (this.grounded && Math.hypot(this.velocity.x, this.velocity.z) > 1.5) {
      this.footstep -= dt
      if (this.footstep <= 0) {
        this.footstep = this.sprinting ? 0.3 : 0.48
        events.push({ type: 'footstep', water: this.inWater })
      }
    } else {
      this.footstep = 0
    }

    // Safe respawn point on dry, gentle ground.
    if (this.grounded && !this.inWater) {
      this.safeTimer += dt
      if (this.safeTimer > 0.5) {
        this.safe.set(this.position.x, this.position.y + 0.4, this.position.z)
        this.safeTimer = 0
      }
    }

    this.root.position.copy(this.position)
    this.root.rotation.y = this.facing
  }

  private wishDirection(intent: PlayerIntent, cameraYaw: number): THREE.Vector3 {
    const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw))
    const right = new THREE.Vector3(-forward.z, 0, forward.x)
    const wish = new THREE.Vector3().addScaledVector(right, intent.moveX).addScaledVector(forward, intent.moveY)
    if (wish.lengthSq() > 1) wish.normalize()
    return wish
  }

  private locomotion(dt: number, wish: THREE.Vector3, wishLen: number, intent: PlayerIntent, events: PlayerEvent[]): void {
    const waterDepth = WATER_LEVEL - this.world.groundAt(this.position.x, this.position.z, this.position.y)
    this.inWater = this.position.y < WATER_LEVEL - 0.15 && waterDepth > 0.4
    this.swimming = this.inWater && this.position.y < WATER_LEVEL + 0.4
    const slope = this.world.slopeAt(this.position.x, this.position.z)
    this.climbing = false

    if (this.swimming) {
      const speed = intent.sprint && this.stamina > 0 ? 4.6 : 3.1
      if (intent.sprint && wishLen > 0.1) this.spendStamina(dt * 10)
      this.velocity.x = damp(this.velocity.x, wish.x * speed, 5, dt)
      this.velocity.z = damp(this.velocity.z, wish.z * speed, 5, dt)
      const surface = WATER_LEVEL - 1.15
      const targetY = intent.jumpHeld ? surface - 0.6 : surface
      this.velocity.y = damp(this.velocity.y, (targetY - this.position.y) * 2.2, 6, dt)
      if (intent.jumpPressed) this.velocity.y = 5.5
      events.push({ type: 'swim' })
      return
    }

    // Climbing: steep terrain while pushing into it.
    if (slope > 1.05 && wishLen > 0.3 && this.stamina > 1 && !this.grounded) {
      const up = wish.clone().setY(0).normalize()
      const ground = this.world.groundAt(this.position.x, this.position.z, this.position.y)
      if (this.position.y < ground + 1.2) {
        this.climbing = true
        this.velocity.set(up.x * 1.4, 2.6, up.z * 1.4)
        this.spendStamina(dt * 13)
        events.push({ type: 'climb' })
        return
      }
    }

    const canSprint = intent.sprint && this.stamina > 1 && wishLen > 0.2
    this.sprinting = canSprint
    const stats = this.effective
    let speed = canSprint ? stats.moveSpeed * 1.72 : stats.moveSpeed
    if (this.blocking) speed *= 0.42
    if (this.inWater) speed *= 0.6
    if (canSprint) this.spendStamina(dt * 11)

    const target = wish.clone().multiplyScalar(speed * Math.min(1, wishLen))
    const accel = this.grounded ? 16 : 5
    this.velocity.x = damp(this.velocity.x, target.x, accel, dt)
    this.velocity.z = damp(this.velocity.z, target.z, accel, dt)

    // Jump / glide.
    if (this.jumpBuffer > 0 && (this.grounded || this.coyote > 0)) {
      this.velocity.y = 9.2
      this.grounded = false
      this.coyote = 0
      this.jumpBuffer = 0
      events.push({ type: 'jump' })
    }
    const falling = this.velocity.y < -1.5
    this.gliding = !this.grounded && falling && intent.jumpHeld && this.stamina > 2
    if (this.gliding) {
      this.velocity.y = Math.max(this.velocity.y, -2.6)
      this.spendStamina(dt * 7)
      events.push({ type: 'glide' })
    }
    this.velocity.y = Math.max(-55, this.velocity.y + GRAVITY * dt)
  }

  private integrate(dt: number, events: PlayerEvent[]): void {
    const colliders = this.world.collidersNear(this.position.x, this.position.z)
    let nx = this.position.x + this.velocity.x * dt
    let nz = this.position.z + this.velocity.z * dt
    const feet = this.position.y
    const head = feet + 1.75
    for (let pass = 0; pass < 2; pass += 1) {
      for (const collider of colliders) {
        const resolved = resolveCircle(nx, nz, RADIUS, collider, feet, head)
        if (resolved) {
          nx = resolved.x
          nz = resolved.z
        }
      }
    }

    // Steep walls block horizontal movement instead of teleporting the player up.
    const groundAhead = this.world.groundAt(nx, nz, feet)
    if (!this.climbing && groundAhead > feet + STEP_HEIGHT && this.velocity.y <= 0.1) {
      const tryX = this.world.groundAt(nx, this.position.z, feet)
      const tryZ = this.world.groundAt(this.position.x, nz, feet)
      if (tryX <= feet + STEP_HEIGHT) nz = this.position.z
      else if (tryZ <= feet + STEP_HEIGHT) nx = this.position.x
      else {
        nx = this.position.x
        nz = this.position.z
      }
      this.velocity.x *= 0.4
      this.velocity.z *= 0.4
    }

    this.position.x = nx
    this.position.z = nz
    this.position.y += this.velocity.y * dt

    const ground = this.world.groundAt(this.position.x, this.position.z, this.position.y)
    if (this.position.y <= ground + 0.02) {
      if (!this.grounded && this.velocity.y < -8) {
        events.push({ type: 'land', impact: clamp(-this.velocity.y / 30, 0, 1) })
      }
      this.position.y = ground
      if (this.velocity.y < 0) this.velocity.y = 0
      this.grounded = true
      this.coyote = 0.12
    } else {
      if (this.grounded) this.coyote = 0.12
      this.grounded = false
    }

    // The world is a bounded continent: never fall through the sea floor.
    const floor = this.world.groundAt(this.position.x, this.position.z, this.position.y)
    if (this.position.y < floor - 2) this.position.y = floor
  }

  private startRoll(wish: THREE.Vector3, wishLen: number, events: PlayerEvent[]): void {
    const direction = wishLen > 0.2 ? wish.clone().setY(0).normalize() : new THREE.Vector3(-Math.sin(this.facing), 0, -Math.cos(this.facing))
    this.rollDirection.copy(direction)
    this.mode = 'roll'
    this.actionDuration = 0.5
    this.actionTimer = 0.5
    this.invulnerable = Math.max(this.invulnerable, 0.34)
    this.spendStamina(18)
    events.push({ type: 'roll' })
  }

  private startAttack(charged: boolean, events: PlayerEvent[]): void {
    const profile = this.weaponProfile
    const chained = this.comboWindow > 0
    this.comboIndex = chained ? (this.comboIndex + 1) % Math.max(1, profile.combo) : 0
    const duration = attackDuration(profile, this.effective.attackSpeed, this.comboIndex) * (charged ? 1.35 : 1)
    this.mode = 'attack'
    this.actionDuration = duration
    this.actionTimer = duration
    this.hitEmitted = false
    this.chargedAttack = charged
    this.chargeTime = 0
    this.comboWindow = 0
    this.spendStamina(profile.stamina * (charged ? 1.5 : 1))
    this.lastCombatAt = this.animTime
    void charged
    events.push({ type: 'swing', charged })
  }

  private updateActionTimers(dt: number, events: PlayerEvent[]): void {
    if (this.mode !== 'attack' || this.hitEmitted) return
    const profile = this.weaponProfile
    const elapsed = this.actionDuration - this.actionTimer
    const hitAt = profile.ranged === 'nenhum' ? this.actionDuration * 0.38 : this.actionDuration * 0.3
    if (elapsed >= hitAt) {
      this.hitEmitted = true
      const window: AttackWindow = {
        reach: profile.reach * (this.chargedAttack ? 1.15 : 1),
        arc: profile.arc * (this.chargedAttack ? 1.25 : 1),
        multiplier: comboMultiplier(profile, this.comboIndex, this.chargedAttack),
        charged: this.chargedAttack,
        knockback: profile.knockback * (this.chargedAttack ? 1.8 : 1),
        ranged: profile.ranged,
        weapon: profile.id,
      }
      events.push({ type: 'attack', window, combo: this.comboIndex })
    }
    void dt
  }

  /** Damage after defence; returns the amount actually applied. */
  takeDamage(rawAmount: number, from?: THREE.Vector3): number {
    if (this.mode === 'dead' || this.invulnerable > 0) return 0
    let amount = rawAmount * (100 / (100 + this.effective.defense * 1.6))
    if (this.blocking && from) {
      const toSource = Math.atan2(-(from.x - this.position.x), -(from.z - this.position.z))
      let delta = Math.abs(((toSource - this.facing + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
      delta = Math.abs(delta)
      if (delta < Math.PI * 0.55) {
        if (this.parryWindow > 0) {
          this.stamina = Math.max(0, this.stamina - 4)
          this.invulnerable = 0.25
          return -1
        }
        amount *= 0.28
        this.spendStamina(9)
      }
    }
    amount = Math.max(1, Math.round(amount))
    this.health = Math.max(0, this.health - amount)
    this.invulnerable = 0.55
    this.lastDamageAt = this.animTime
    this.lastCombatAt = this.animTime
    this.mode = this.mode === 'attack' && this.weaponProfile.id === 'espadao' ? this.mode : 'hurt'
    this.actionTimer = this.mode === 'hurt' ? 0.32 : this.actionTimer
    this.actionDuration = 0.32
    if (from) {
      const away = new THREE.Vector3(this.position.x - from.x, 0, this.position.z - from.z).normalize().multiplyScalar(4)
      this.velocity.x += away.x
      this.velocity.z += away.z
    }
    if (this.health <= 0) {
      this.mode = 'dead'
      this.actionTimer = 999
      this.deaths += 1
    }
    return amount
  }

  heal(amount: number): number {
    const before = this.health
    this.health = Math.min(this.stats.maxHealth, this.health + amount)
    return this.health - before
  }

  restoreMana(amount: number): number {
    const before = this.mana
    this.mana = Math.min(this.stats.maxMana, this.mana + amount)
    return this.mana - before
  }

  restoreStamina(amount: number): number {
    const before = this.stamina
    this.stamina = Math.min(this.stats.maxStamina, this.stamina + amount)
    return this.stamina - before
  }

  spendMana(amount: number): boolean {
    if (this.mana < amount) return false
    this.mana -= amount
    this.manaDelay = 2.2
    return true
  }

  spendStamina(amount: number): void {
    this.stamina = Math.max(0, this.stamina - amount)
    this.staminaDelay = 0.8
  }

  startCast(duration: number): void {
    this.mode = 'cast'
    this.actionDuration = duration
    this.actionTimer = duration
    this.lastCombatAt = this.animTime
  }

  triggerParry(): void {
    this.parryWindow = 0.28
  }

  /** Pose the rig for rendering. */
  render(dt: number): void {
    const speed = Math.hypot(this.velocity.x, this.velocity.z)
    let mode: AnimMode = 'idle'
    let rollDirection: NonNullable<AnimState['rollDirection']> = 'forward'
    if (this.mode === 'dead') mode = 'dead'
    else if (this.mode === 'roll') mode = 'roll'
    else if (this.mode === 'attack') mode = 'attack'
    else if (this.mode === 'cast') mode = 'cast'
    else if (this.mode === 'hurt') mode = 'hurt'
    else if (this.climbing) mode = 'climb'
    else if (this.swimming) mode = 'swim'
    else if (this.gliding) mode = 'glide'
    else if (!this.grounded) mode = this.velocity.y > 0 ? 'jump' : 'fall'
    else if (this.blocking) mode = 'block'
    else if (speed > 0.6) mode = this.sprinting ? 'run' : 'walk'
    if (this.mode === 'roll') {
      const cosine = Math.cos(this.facing)
      const sine = Math.sin(this.facing)
      const localX = cosine * this.rollDirection.x - sine * this.rollDirection.z
      const localZ = sine * this.rollDirection.x + cosine * this.rollDirection.z
      if (Math.abs(localX) > Math.abs(localZ)) rollDirection = localX > 0 ? 'right' : 'left'
      else rollDirection = localZ > 0 ? 'backward' : 'forward'
    }
    this.model.animate(dt, {
      mode,
      speed,
      actionTime: this.actionDuration - this.actionTimer,
      actionDuration: this.actionDuration,
      combo: this.comboIndex,
      weapon: this.weapon,
      charging: this.chargeTime > 0.4,
      rollDirection,
    })
    // Model sits on the feet pivot; lean the whole root while swimming.
    this.model.root.position.y = 0
    this.model.root.rotation.x = this.swimming ? -0.15 : 0
    this.model.root.visible = this.invulnerable <= 0 || this.animTime - this.lastDamageAt > 0.55 || Math.floor(this.animTime * 18) % 2 === 0
  }

  /** Distance from the ground for shadows and camera effects. */
  get heightAboveGround(): number {
    return this.position.y - this.world.groundAt(this.position.x, this.position.z, this.position.y)
  }
}
