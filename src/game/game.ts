import * as THREE from 'three'
import type { Audio } from '../engine/audio'
import type { GameSave, SaveStore, Settings } from '../engine/save'
import { clamp, damp } from './core/math'
import type { BiomeId, BossType, ElementId, QuestDef, ShopId } from './data/types'
import { bossById } from './data/bossData'
import { enemyById } from './data/enemyData'
import { itemById } from './data/itemData'
import { npcById } from './data/npcData'
import { questById } from './data/questData'
import { recipeById } from './data/recipeData'
import { CameraRig } from './camera'
import { Boss, type BossEvent } from './entities/boss'
import { Enemy, type EnemyContext, type EnemyEvent } from './entities/enemy'
import { Player, type PlayerEvent, type PlayerIntent } from './entities/player'
import { Population } from './entities/population'
import { Spawner } from './entities/spawner'
import type { CharacterProfile } from './data/characterProfile'
import { Effects } from './combat/effects'
import { Projectiles } from './combat/projectiles'
import { abilityUnlocked, abilitiesFor, type AbilityDef } from './combat/abilities'
import { ELEMENTS, criticalDamage, rollCritical } from './combat/damage'
import { weaponProfile } from './combat/weapons'
import { Inventory } from './systems/inventory'
import { Progression, derivedStats, type AttributeKey, type DerivedStats, type StatBonus } from './systems/stats'
import { SkillTree } from './systems/skills'
import { QuestLog } from './systems/quests'
import { DialogueRunner } from './systems/dialogue'
import { Shop, buyPrice, craft as craftRecipe, sellPrice, shopFor } from './systems/economy'
import { bossLoot, rollLoot, type LootDrop } from './systems/loot'
import { BIOMES } from './world/biomes'
import type { HouseDoor, Poi } from './world/poi'
import type { BiomeWaypoint } from './world/terrain'
import type { World } from './world/world'
import { createHouseInterior } from './world/interior'
import type { Ui } from '../ui/ui'
import type { HudAbility, HudPoi, HudSnapshot } from '../ui/hud'
import type { PanelActions, PanelContext } from '../ui/panels'
import { generateWorldMap } from '../ui/map'

export type GameInput = PlayerIntent & { lookX: number; lookY: number; interact: boolean }

export type GameDeps = {
  world: World
  camera: CameraRig
  ui: Ui
  audio: Audio
  save: SaveStore
  onQuit: () => void
  onResumeRequest: () => void
}

export type GameMode = 'playing' | 'paused' | 'dead' | 'victory'

const FINAL_BOSS = 'soberano-da-sombra'
const AUTOSAVE_SECONDS = 30
const WEATHER_LABEL: Record<string, string> = {
  limpo: 'Céu limpo', chuva: 'Chuva', tempestade: 'Tempestade', neve: 'Neve', areia: 'Tempestade de areia', neblina: 'Neblina', cinzas: 'Chuva de cinzas',
}

type CombatTarget = {
  position: THREE.Vector3
  radius: number
  height: number
  alive: boolean
  takeDamage: (amount: number, options?: { element?: ElementId; crit?: boolean; knockback?: number; from?: THREE.Vector3 }) => { amount: number; crit: boolean; killed: boolean }
}

type HouseSession = {
  houseId: string
  houseName: string
  returnPosition: THREE.Vector3
  returnFacing: number
  exitPosition: THREE.Vector3
}

/** Owns the simulation: player, creatures, bosses, loot, quests, NPCs and persistence. */
export class Game {
  readonly world: World
  readonly camera: CameraRig
  readonly ui: Ui
  readonly player: Player
  readonly inventory = new Inventory()
  readonly progression = new Progression()
  readonly skills = new SkillTree()
  readonly quests = new QuestLog()
  readonly dialogue = new DialogueRunner()
  readonly effects: Effects
  readonly projectiles: Projectiles
  readonly spawner: Spawner
  readonly population: Population
  mode: GameMode = 'playing'
  reducedMotion = false
  playtime = 0
  kills = 0
  deaths = 0
  boss: Boss | null = null
  bossPoi: Poi | null = null
  target: CombatTarget | null = null
  mapCanvas: HTMLCanvasElement | null = null
  onModeChange?: (mode: GameMode) => void

  private readonly audio: Audio
  private readonly save: SaveStore
  private readonly deps: GameDeps
  private readonly discovered = new Set<string>()
  private readonly openedChests = new Set<string>()
  private readonly defeatedBosses = new Set<string>()
  private readonly storyFlags = new Set<string>()
  private shop: Shop | null = null
  private interior: HouseSession | null = null
  private autosave = 0
  private hitstop = 0
  private shakeCooldown = 0
  private dialogueOffers: QuestDef[] = []
  private dialogueTurnIns: QuestDef[] = []
  private pendingStats: DerivedStats
  private panelActions: PanelActions
  private spawnPoint = new THREE.Vector3()
  private frameEnemies: CombatTarget[] = []
  private compassTimer = 0
  private huntWaypointCache: { targetId: string; originX: number; originZ: number; waypoint: BiomeWaypoint | null } | null = null

  constructor(deps: GameDeps) {
    this.deps = deps
    this.world = deps.world
    this.camera = deps.camera
    this.ui = deps.ui
    this.audio = deps.audio
    this.save = deps.save
    this.effects = new Effects(this.world.scene)
    this.projectiles = new Projectiles(this.world.scene, this.effects)
    this.spawner = new Spawner(this.world.scene, this.save.data.settings.quality)
    this.population = new Population(this.world.scene, this.world, this.world.pois, this.spawner)
    this.pendingStats = derivedStats(this.progression.attributes, this.progression.level, this.inventory.bonus())
    const spawn = new THREE.Vector3(this.world.spawn.x, this.world.groundAt(this.world.spawn.x, this.world.spawn.z, 200), this.world.spawn.z)
    this.spawnPoint.copy(spawn)
    this.player = new Player(
      {
        groundAt: (x, z, feetY) => this.world.groundAt(x, z, feetY),
        collidersNear: (x, z) => this.world.collidersNear(x, z),
        isWater: (x, z) => this.world.isWater(x, z),
        slopeAt: (x, z) => this.world.isInterior ? 0 : this.world.terrain.slopeAt(x, z),
      },
      spawn,
      this.pendingStats,
      undefined,
      this.save.data.profile,
    )
    this.world.scene.add(this.player.root)
    this.player.model.setEquipment({ weapon: 'espada' })
    this.panelActions = this.buildPanelActions()
    this.bindHud()
    this.applySettings(this.save.data.settings)
  }

  // ── lifecycle ────────────────────────────────────────────────────────────
  start(fresh: boolean): void {
    const saved = fresh ? null : this.save.data.game
    this.inventory.reset()
    this.progression.reset()
    this.skills.reset()
    if (fresh) this.save.clearGame()
    this.quests.states.clear()
    this.quests.tracked = null
    this.discovered.clear()
    this.openedChests.clear()
    this.defeatedBosses.clear()
    this.storyFlags.clear()
    this.interior = null
    this.world.exitInterior()
    this.spawner.clear()
    this.projectiles.clear()
    this.effects.clear()
    this.boss?.dispose()
    this.boss = null
    this.bossPoi = null
    this.kills = 0
    this.deaths = 0
    this.playtime = 0
    this.mode = 'playing'
    this.player.teleport(this.spawnPoint)
    this.player.respawn()
    this.inventory.add('arma-espada-1')
    this.inventory.add('pocao-vida-1', 3)
    this.inventory.add('pocao-mana-1', 2)
    this.inventory.add('comida-pao', 2)
    if (saved) this.loadFrom(saved)
    const shouldIntroduceIara = !this.storyFlags.has('iara-intro') && !this.quests.state('principal-01')
    if (shouldIntroduceIara) this.spawnPoint.copy(this.world.spawn)
    this.refreshStats()
    this.world.sky.timeOfDay = saved?.timeOfDay ?? 0.3
    const returnPosition = saved
      ? new THREE.Vector3(saved.position[0], saved.position[1], saved.position[2])
      : this.spawnPoint.clone()
    this.player.teleport(shouldIntroduceIara ? this.world.spawn : returnPosition)
    if (!shouldIntroduceIara && saved?.interior) {
      this.enterHouse(saved.interior.houseId, saved.interior.houseName, returnPosition, saved.facing, false)
    }
    this.camera.reset(this.player.position, this.player.facing)
    this.camera.update(0, this.player.position, { x: 0, y: 0 }, this.world, false, false)
    this.population.update(0, this.player.position)
    this.updateNpcQuestMarkers()
    this.ui.showGame()
    this.ui.closePanels()
    this.updateHud(0)
    this.onModeChange?.(this.mode)
    this.ui.toast(saved ? 'Aventura retomada' : 'Uma nova jornada começa', 'quest')
    this.saveGame(true)
    if (shouldIntroduceIara && this.population.npcs.some(npc => npc.def.id === 'iara')) this.openNpcDialogue('iara')
  }

  pause(): void {
    if (this.mode !== 'playing') return
    this.mode = 'paused'
    this.onModeChange?.(this.mode)
    this.ui.openPause(this.panelContext())
    this.saveGame()
  }

  resume(): void {
    if (this.mode !== 'paused') return
    this.mode = 'playing'
    this.ui.closePanels()
    this.onModeChange?.(this.mode)
  }

  toTitle(): void {
    this.mode = 'paused'
    this.ui.closePanels()
    this.ui.hideDialogue()
  }

  applySettings(settings: Settings): void {
    this.audio.setVolumes(settings.musicVolume, settings.sfxVolume, settings.muted)
    this.camera.camera.fov = settings.quality === 'low' ? 74 : 68
    this.camera.camera.updateProjectionMatrix()
    this.reducedMotion = settings.reducedMotion
    this.world.setQuality(settings.quality)
  }

  applyCharacterProfile(profile: CharacterProfile): void {
    this.player.setCharacterProfile(profile)
  }

  // ── main update ──────────────────────────────────────────────────────────
  update(dt: number, input: GameInput): void {
    if (this.mode !== 'playing') return
    const frame = Math.min(dt, 1 / 20)
    this.playtime += frame
    this.hitstop = Math.max(0, this.hitstop - frame)
    this.shakeCooldown = Math.max(0, this.shakeCooldown - frame)
    const sim = this.hitstop > 0 ? frame * 0.25 : frame

    this.world.update(sim, this.camera.camera, this.player.position)
    this.camera.update(sim, this.player.position, { x: input.lookX, y: input.lookY }, {
      groundAt: (x, z, y) => this.world.groundAt(x, z, y),
      collidersNear: (x, z) => this.world.collidersNear(x, z),
    }, this.player.sprinting, this.player.gliding)

    const playerEvents: PlayerEvent[] = []
    const intent: PlayerIntent = {
      moveX: input.moveX,
      moveY: input.moveY,
      sprint: input.sprint,
      jumpPressed: input.jumpPressed,
      jumpHeld: input.jumpHeld,
      rollPressed: input.rollPressed,
      attackPressed: this.interior ? false : input.attackPressed,
      attackHeld: this.interior ? false : input.attackHeld,
      blockHeld: this.interior ? false : input.blockHeld,
    }
    this.player.step(sim, intent, this.camera.yaw, playerEvents)
    for (const event of playerEvents) this.onPlayerEvent(event)

    if (this.interior) {
      this.updateInteraction(input)
      this.regen(sim)
      this.player.render(sim)
      this.updateHud(frame)
      this.autosave += frame
      if (this.autosave > AUTOSAVE_SECONDS) {
        this.autosave = 0
        this.saveGame(true)
      }
      return
    }

    const ctx: EnemyContext = {
      playerPosition: this.player.position,
      playerDead: this.player.dead,
      playerStealth: this.player.effective.stealth,
      groundAt: (x, z, feetY) => this.world.groundAt(x, z, feetY),
      collidersNear: (x, z) => this.world.collidersNear(x, z),
      night: this.world.sky.night,
      inCombat: this.player.inCombat,
    }
    this.frameEnemies.length = 0
    for (const enemy of this.spawner.enemies) {
      if (enemy.dead) {
        enemy.render(sim, this.camera.camera)
        continue
      }
      const events: EnemyEvent[] = []
      enemy.update(sim, ctx, events)
      for (const event of events) this.onEnemyEvent(event, enemy)
      enemy.render(sim, this.camera.camera)
      if (enemy.alive) this.frameEnemies.push(this.enemyTarget(enemy))
    }
    if (this.boss) {
      const events: BossEvent[] = []
      this.boss.update(sim, ctx, events)
      for (const event of events) this.onBossEvent(event)
      this.boss.render(sim, this.camera.camera)
    }

    this.projectiles.update(sim, {
      enemies: this.frameEnemies.map(target => this.asProjectileTarget(target)),
      player: {
        position: this.player.position,
        radius: 0.5,
        height: 1.7,
        alive: this.mode === 'playing',
        takeDamage: (amount, element, crit, from) => {
          void element
          void crit
          this.damagePlayer(amount, from)
        },
      },
      groundAt: (x, z, feetY) => this.world.groundAt(x, z, feetY),
      colliders: (x, z) => this.world.collidersNear(x, z),
      onPlayerHit: (_projectile, target) => {
        void target
      },
      onEnemyHit: (projectile, target) => {
        const source = (target as typeof target & { source?: CombatTarget }).source
        if (!source) return
        const result = source.takeDamage(projectile.damage, { element: projectile.element, crit: projectile.crit, from: projectile.position })
        this.ui.popDamage(source.position.clone().setY(source.position.y + source.height * 0.9), String(result.amount), result.crit ? 'crit' : projectile.element ? 'magic' : 'hit')
        if (result.killed) this.onTargetKilled(source)
      },
    })

    this.effects.update(sim)
    this.population.update(sim, this.player.position)
    this.updateNpcQuestMarkers()
    this.markSavedChests()
    this.spawner.update(sim, {
      playerPosition: this.player.position,
      biome: this.world.biomeAt(this.player.position.x, this.player.position.z),
      night: this.world.sky.night,
      level: this.progression.level,
      isBlocked: (x, z) => this.world.pois.isBlocked(x, z),
      groundAt: (x, z, feetY) => this.world.groundAt(x, z, feetY),
      isWater: (x, z) => this.world.isWater(x, z),
    })

    this.updateDiscovery(sim)
    this.updateBossSpawn(sim)
    this.updateInteraction(input)
    this.regen(sim)
    this.updateTarget()
    this.player.render(sim)
    this.updateHud(frame)
    this.checkDeath()
    this.autosave += frame
    if (this.autosave > AUTOSAVE_SECONDS) {
      this.autosave = 0
      this.saveGame(true)
    }
  }

  private regen(dt: number): void {
    if (this.player.inCombat) return
    if (this.player.health < this.player.effective.maxHealth) {
      this.player.heal(this.player.effective.maxHealth * 0.012 * dt)
    }
    if (this.player.mana < this.player.effective.maxMana) this.player.restoreMana(this.player.effective.maxMana * 0.035 * dt)
    if (this.player.stamina < this.player.effective.maxStamina) this.player.restoreStamina(this.player.effective.maxStamina * 0.08 * dt)
  }

  // ── player events and combat ─────────────────────────────────────────────
  private onPlayerEvent(event: PlayerEvent): void {
    switch (event.type) {
      case 'swing':
        this.audio.play('sword')
        this.effects.slash(this.player.position, this.player.facing, this.player.weaponProfile.reach, '#f0e6cf')
        break
      case 'attack':
        this.resolvePlayerAttack(event.window, event.combo)
        break
      case 'cast':
        this.audio.play('cast')
        this.effects.rise(this.player.position, ELEMENTS[this.player.element].color, 12, 0.7)
        break
      case 'jump':
        this.audio.play('jump')
        break
      case 'land':
        this.audio.play('land')
        if (event.impact > 0.5) this.camera.addShake(event.impact * 0.5)
        break
      case 'roll':
        this.audio.play('dash')
        break
      case 'hurt':
        this.audio.play('hurt')
        this.camera.addShake(0.4)
        this.ui.setVignette(true)
        window.setTimeout(() => this.ui.setVignette(false), 220)
        break
      case 'die':
        this.onPlayerDeath()
        break
      case 'footstep':
        break
      case 'parry':
        this.audio.play('parry')
        this.effects.flash(this.player.position.clone().setY(this.player.position.y + 1.2), 1.4, '#ffe9b8', 0.25)
        this.hitstop = 0.09
        break
      default:
        break
    }
  }

  private resolvePlayerAttack(window: { reach: number; arc: number; multiplier: number; charged: boolean; knockback: number; ranged: string; weapon: string }, combo: number): void {
    const stats = this.player.effective
    const profile = weaponProfile(this.player.weapon)
    if (window.ranged === 'flecha' || window.ranged === 'energia') {
      const direction = this.aimDirection()
      const crit = rollCritical(stats.critChance + profile.critBonus)
      const power = window.ranged === 'flecha' ? stats.attack * 1.1 : stats.spellPower * 1.05
      this.projectiles.spawn({
        owner: 'player',
        position: this.player.position.clone().setY(this.player.position.y + 1.35).add(direction.clone().multiplyScalar(0.6)),
        direction,
        speed: window.ranged === 'flecha' ? 42 : 26,
        damage: criticalDamage(power * window.multiplier * (1 + this.skills.effects().physicalDamage), crit),
        radius: window.ranged === 'flecha' ? 0.28 : 0.4,
        kind: window.ranged === 'flecha' ? 'flecha' : 'energia',
        color: window.ranged === 'flecha' ? '#e8dcc0' : ELEMENTS[this.player.element].color,
        element: window.ranged === 'flecha' ? undefined : this.player.element,
        crit,
        life: 2.2,
        pierce: window.charged ? 2 : 0,
      })
      this.audio.play(window.ranged === 'flecha' ? 'arrow' : 'cast')
      return
    }
    const direction = new THREE.Vector3(-Math.sin(this.player.facing), 0, -Math.cos(this.player.facing))
    const damage = stats.attack * window.multiplier * (1 + this.skills.effects().physicalDamage)
    this.damageInArc(this.player.position, direction, window.reach, window.arc, damage, {
      element: this.inventory.weaponElement(),
      knockback: window.knockback,
      charged: window.charged,
      combo,
    })
  }

  private damageInArc(origin: THREE.Vector3, direction: THREE.Vector3, reach: number, arc: number, damage: number, options: { element?: ElementId; knockback: number; charged: boolean; combo: number }): void {
    const targets = this.allTargets()
    let hits = 0
    for (const target of targets) {
      if (!target.alive) continue
      const dx = target.position.x - origin.x
      const dz = target.position.z - origin.z
      const distance = Math.hypot(dx, dz)
      if (distance > reach + target.radius) continue
      const dy = Math.abs(target.position.y - origin.y)
      if (dy > 3.2) continue
      const dot = distance < 0.2 ? 1 : (dx / distance) * direction.x + (dz / distance) * direction.z
      if (dot < Math.cos(arc)) continue
      const crit = rollCritical(this.player.effective.critChance + this.player.weaponProfile.critBonus)
      const result = target.takeDamage(criticalDamage(damage, crit), { element: options.element, crit, knockback: options.knockback, from: origin })
      hits += 1
      this.ui.popDamage(target.position.clone().setY(target.position.y + target.height * 0.9), String(result.amount), crit ? 'crit' : 'hit')
      this.audio.play(crit ? 'heavy' : 'hit')
      this.effects.burst(target.position.clone().setY(target.position.y + 1), crit ? '#ffd166' : '#ffd9c0', crit ? 14 : 7, 4, 0.4)
      const lifesteal = this.player.effective.lifesteal + this.skills.effects().lifesteal
      if (lifesteal > 0) this.player.heal(result.amount * lifesteal)
      if (result.killed) this.onTargetKilled(target)
    }
    if (hits > 0) {
      this.hitstop = options.charged ? 0.1 : 0.045
      if (!this.reducedMotion) this.camera.addShake(options.charged ? 0.45 : 0.16)
    }
  }

  private aimDirection(): THREE.Vector3 {
    const forward = this.camera.forward.clone().normalize()
    const pitch = -this.camera.pitch
    forward.y = Math.sin(pitch) * 0.8
    return forward.normalize()
  }

  private allTargets(): CombatTarget[] {
    const list: CombatTarget[] = [...this.frameEnemies]
    if (this.boss && !this.boss.dead) list.push(this.bossTarget(this.boss))
    return list
  }

  private enemyTarget(enemy: Enemy): CombatTarget {
    return {
      position: enemy.position,
      radius: enemy.radius,
      height: enemy.height,
      alive: enemy.alive,
      takeDamage: (amount, options) => {
        const result = enemy.takeDamage(amount, options ?? {})
        if (options?.element) enemy.applyStatus(statusForElement(options.element), 3, 1)
        return result
      },
    }
  }

  private asProjectileTarget(target: CombatTarget): { position: THREE.Vector3; radius: number; height: number; alive: boolean; takeDamage: (amount: number, element?: ElementId, crit?: boolean, from?: THREE.Vector3) => void; source: CombatTarget } {
    return {
      position: target.position,
      radius: target.radius,
      height: target.height,
      alive: target.alive,
      takeDamage: (amount, element, crit, from) => {
        const result = target.takeDamage(amount, { element, crit, from })
        if (result.killed) this.onTargetKilled(target)
      },
      source: target,
    }
  }

  private bossTarget(boss: Boss): CombatTarget {
    return {
      position: boss.position,
      radius: boss.radius,
      height: 4,
      alive: !boss.dead,
      takeDamage: (amount, options) => boss.takeDamage(amount, options ?? {}),
    }
  }

  private onTargetKilled(target: CombatTarget): void {
    if (this.boss && target.position === this.boss.position) {
      this.onBossDeath(this.boss)
      return
    }
    const enemy = this.spawner.enemies.find(entry => entry.position === target.position)
    if (enemy) this.onEnemyDeath(enemy)
  }

  private onEnemyEvent(event: EnemyEvent, enemy: Enemy): void {
    switch (event.type) {
      case 'melee': {
        const dx = this.player.position.x - enemy.position.x
        const dz = this.player.position.z - enemy.position.z
        const distance = Math.hypot(dx, dz)
        if (distance > event.range + 0.6) break
        const facing = new THREE.Vector3(-Math.sin(enemy.facing), 0, -Math.cos(enemy.facing))
        const dot = distance < 0.2 ? 1 : (dx / distance) * facing.x + (dz / distance) * facing.z
        if (dot < Math.cos(event.arc)) break
        this.damagePlayer(event.damage, enemy.position, event.element, event.heavy)
        break
      }
      case 'projectile':
        this.projectiles.spawn({
          owner: 'enemy',
          position: event.from,
          direction: event.dir,
          speed: event.speed,
          damage: event.damage,
          radius: event.radius,
          kind: event.element === 'fogo' ? 'fogo' : event.element === 'gelo' ? 'gelo' : event.element === 'raio' ? 'raio' : event.element === 'sombra' ? 'sombra' : 'energia',
          color: event.element ? ELEMENTS[event.element].color : '#c9b6ff',
          element: event.element,
          life: 4,
        })
        break
      case 'summon': {
        const def = enemyById(event.enemyId)
        if (!def) break
        for (let i = 0; i < event.count; i += 1) {
          const angle = Math.random() * Math.PI * 2
          this.spawner.add({ def, level: Math.max(1, enemy.level - 2), x: enemy.position.x + Math.cos(angle) * 2.5, z: enemy.position.z + Math.sin(angle) * 2.5 })
        }
        break
      }
      case 'death':
        this.onEnemyDeath(enemy)
        break
    }
  }

  private onEnemyDeath(enemy: Enemy): void {
    if (enemy.counted) return
    enemy.counted = true
    this.kills += 1
    this.player.kills = this.kills
    this.audio.play('death')
    const level = enemy.level
    const xp = Math.round(enemy.xp * (enemy.elite ? 1.6 : 1))
    this.grantXp(xp)
    const gold = Math.round((2 + Math.random() * 5) * level * (enemy.elite ? 2 : 1))
    this.inventory.gold += gold
    this.ui.toast(`+${xp} XP · +${gold} de ouro`, 'info')
    const drops = rollLoot(enemy.def.loot, this.skills.effects().lootBonus)
    this.giveLoot(drops)
    this.quests.progress('matar', enemy.def.id)
    this.quests.syncInventory(this.inventory)
    this.checkQuestReady()
    this.effects.explosion(enemy.position.clone().setY(enemy.position.y + 0.8), 1.6, enemy.def.colors.glow ?? '#c9b6ff')
  }

  private onBossEvent(event: BossEvent): void {
    switch (event.type) {
      case 'aoe': {
        this.effects.explosion(event.center, event.radius, event.element ? ELEMENTS[event.element].color : '#ffb347')
        const distance = Math.hypot(this.player.position.x - event.center.x, this.player.position.z - event.center.z)
        if (distance < event.radius + 0.6 && Math.abs(this.player.position.y - event.center.y) < 3) this.damagePlayer(event.damage, event.center, event.element, true)
        if (!this.reducedMotion) this.camera.addShake(0.6)
        break
      }
      case 'cone': {
        const dx = this.player.position.x - event.origin.x
        const dz = this.player.position.z - event.origin.z
        const distance = Math.hypot(dx, dz)
        const dot = distance < 0.2 ? 1 : (dx / distance) * event.direction.x + (dz / distance) * event.direction.z
        this.effects.slash(event.origin, Math.atan2(-event.direction.x, -event.direction.z), event.range, event.element ? ELEMENTS[event.element].color : '#ffb347')
        if (distance < event.range && dot > Math.cos(event.arc)) this.damagePlayer(event.damage, event.origin, event.element, true)
        break
      }
      case 'projectile':
        this.projectiles.spawn({
          owner: 'enemy',
          position: event.from,
          direction: event.dir,
          speed: event.speed,
          damage: event.damage,
          radius: event.radius,
          kind: 'energia',
          color: event.element ? ELEMENTS[event.element].color : '#c9b6ff',
          element: event.element,
          life: 5,
          aoeRadius: 2.4,
        })
        break
      case 'summon': {
        const def = enemyById(event.enemyId)
        if (!def) break
        for (let i = 0; i < event.count; i += 1) {
          const angle = Math.random() * Math.PI * 2
          this.spawner.add({ def, level: Math.max(1, this.progression.level - 2), x: this.boss!.position.x + Math.cos(angle) * 4, z: this.boss!.position.z + Math.sin(angle) * 4 })
        }
        break
      }
      case 'phase':
        this.ui.toast(`Fase ${event.index + 1}: ${event.name}`, 'warn')
        this.ui.subtitle(this.boss?.name ?? 'Chefe', event.line, 5)
        this.audio.play('roar')
        this.camera.addShake(0.9)
        break
      case 'roar':
        this.audio.play('roar')
        this.camera.addShake(0.7)
        break
      case 'death':
        this.onBossDeath(event.boss)
        break
    }
  }

  private onBossDeath(boss: Boss): void {
    if (this.defeatedBosses.has(boss.def.id)) return
    this.defeatedBosses.add(boss.def.id)
    if (this.bossPoi) this.discovered.add(`boss:${this.bossPoi.id}`)
    this.kills += 1
    this.audio.play('win')
    this.grantXp(boss.def.rewardXp)
    this.inventory.gold += boss.def.rewardGold
    this.giveLoot(bossLoot(boss.def.rewardItems, this.skills.effects().lootBonus))
    this.quests.progress('chefe', boss.def.id)
    this.checkQuestReady()
    this.ui.subtitle(boss.name, 'A escuridão recua. Por um instante, o mundo respira.', 6)
    this.ui.toast(`${boss.name} derrotado`, 'level')
    this.effects.explosion(boss.position.clone().setY(boss.position.y + 2), 8, '#ffd166')
    this.boss = null
    this.bossPoi = null
    this.saveGame(true)
    if (boss.def.id === FINAL_BOSS) this.victory()
  }

  private damagePlayer(amount: number, from?: THREE.Vector3, element?: ElementId, heavy = false): void {
    if (this.mode !== 'playing') return
    const dealt = this.player.takeDamage(amount * (element ? 1 : 1), from)
    if (dealt <= 0) return
    this.ui.popDamage(this.player.position.clone().setY(this.player.position.y + 1.9), `-${dealt}`, 'hurt')
    if (heavy && !this.reducedMotion) this.camera.addShake(0.35)
    this.audio.play('hurt')
  }

  private grantXp(amount: number): void {
    const levels = this.progression.addXp(amount)
    if (levels <= 0) return
    this.refreshStats()
    this.player.health = this.player.effective.maxHealth
    this.player.mana = this.player.effective.maxMana
    this.effects.levelUp(this.player.position)
    this.audio.play('levelup')
    this.ui.toast(`Nível ${this.progression.level}! +5 pontos de atributo, +1 de habilidade`, 'level')
    this.quests.progress('nivel', String(this.progression.level))
  }

  private giveLoot(drops: LootDrop[]): void {
    for (const drop of drops) {
      const def = itemById(drop.itemId)
      if (!def) continue
      const leftover = this.inventory.add(drop.itemId, drop.count)
      if (leftover > 0) {
        this.ui.toast('Mochila cheia — item perdido', 'warn')
        continue
      }
      this.ui.toast(`+ ${def.name}${drop.count > 1 ? ` ×${drop.count}` : ''}`, 'item')
    }
    this.quests.syncInventory(this.inventory)
    this.ui.refreshPanels()
  }

  private checkQuestReady(): void {
    for (const quest of this.quests.active()) {
      if (this.quests.ready(quest.id) && this.quests.state(quest.id)?.progress.notified !== 1) {
        const state = this.quests.state(quest.id)
        if (state) {
          state.progress.notified = 1
          this.ui.toast(`Missão pronta: ${quest.name}`, 'quest')
          this.audio.play('quest')
        }
      }
    }
  }

  private onPlayerDeath(): void {
    if (this.mode === 'dead') return
    this.mode = 'dead'
    this.deaths += 1
    this.player.deaths = this.deaths
    this.audio.play('lose')
    this.onModeChange?.(this.mode)
    this.ui.showDeath(this.kills, this.progression.level, () => this.respawn())
    this.saveGame(true)
  }

  private checkDeath(): void {
    if (this.mode === 'playing' && this.player.dead) this.onPlayerDeath()
  }

  private respawn(): void {
    this.mode = 'playing'
    this.player.respawn()
    this.player.teleport(this.spawnPoint)
    this.camera.reset(this.player.position, this.player.facing)
    this.ui.closePanels()
    this.onModeChange?.(this.mode)
    this.deps.onResumeRequest()
    this.ui.toast('Você desperta no último santuário', 'info')
  }

  private victory(): void {
    this.mode = 'victory'
    this.onModeChange?.(this.mode)
    this.ui.showVictory({ level: this.progression.level, kills: this.kills, deaths: this.deaths, playtime: this.playtime }, () => {
      this.mode = 'playing'
      this.onModeChange?.(this.mode)
      this.deps.onResumeRequest()
    })
    this.saveGame(true)
  }

  // ── abilities ────────────────────────────────────────────────────────────
  abilities(): AbilityDef[] {
    return abilitiesFor(this.player.element)
  }

  selectElement(element: ElementId): void {
    if (this.mode !== 'playing') return
    this.player.setElement(element)
    this.audio.play('ui')
    this.ui.toast(`Elemento: ${ELEMENTS[element].name}`, 'info')
  }

  castAbility(index: number): void {
    if (this.mode !== 'playing' || this.interior) return
    const ability = this.abilities()[index]
    if (!ability) return
    const error = this.player.canCast(ability)
    if (error) {
      if (error !== 'Sem mana.') this.ui.toast(error, 'warn')
      return
    }
    this.player.beginCast(ability)
    this.ui.flashAbility(index)
    this.audio.play(ability.element === 'fogo' ? 'fire' : ability.element === 'gelo' ? 'ice' : ability.element === 'raio' ? 'lightning' : 'cast')
    const stats = this.player.effective
    const effects = this.skills.effects()
    const power = stats.spellPower * ability.power * (1 + effects.magicDamage) * (1 + effects.manaBonus * 0)
    const color = ELEMENTS[ability.element].color
    const direction = this.aimDirection()
    const origin = this.player.position.clone().setY(this.player.position.y + 1.3)
    if (ability.kind === 'projetil') {
      this.projectiles.spawn({
        owner: 'player',
        position: origin.clone().add(direction.clone().multiplyScalar(0.8)),
        direction,
        speed: 26,
        damage: power,
        radius: 0.5,
        kind: 'energia',
        color,
        element: ability.element,
        life: 3,
        homing: ability.tier >= 2 ? 2.2 : 0,
        aoeRadius: ability.tier >= 3 ? ability.radius : 0,
        crit: rollCritical(stats.critChance),
      })
      return
    }
    if (ability.kind === 'area') {
      const center = this.player.position.clone().add(direction.clone().multiplyScalar(Math.min(ability.range, 12)))
      const ground = this.world.groundAt(center.x, center.z, center.y)
      center.y = ground
      this.effects.explosion(center, ability.radius, color)
      this.damageArea(center, ability.radius, power, ability.element, ability.status, ability.statusSeconds)
      return
    }
    if (ability.kind === 'cone') {
      this.effects.slash(this.player.position, Math.atan2(direction.x, direction.z), ability.range, color)
      this.damageInArc(this.player.position, direction, ability.range, ability.arc, power, { element: ability.element, knockback: 1.4, charged: true, combo: 0 })
      for (const enemy of this.spawner.enemies) {
        if (!enemy.alive) continue
        const dx = enemy.position.x - this.player.position.x
        const dz = enemy.position.z - this.player.position.z
        const distance = Math.hypot(dx, dz)
        if (distance > ability.range + enemy.radius) continue
        const dot = distance < 0.2 ? 1 : (dx / distance) * direction.x + (dz / distance) * direction.z
        if (dot >= Math.cos(ability.arc) && ability.status) enemy.applyStatus(ability.status, ability.statusSeconds, 1)
      }
      return
    }
    if (ability.kind === 'buff') {
      this.player.applyBuff({
        id: ability.id,
        name: ability.name,
        seconds: ability.duration,
        defenseMult: 1 + ability.defenseBonus,
        speedMult: 1 + ability.speedBonus,
        critBonus: ability.critBonus,
        stealthBonus: ability.stealthBonus,
      })
      this.effects.rise(this.player.position, color, 24, 1)
      return
    }
    // Mobilidade: dash elemental curto.
    this.player.applyBuff({ id: ability.id, name: ability.name, seconds: Math.max(0.6, ability.duration), defenseMult: 1, speedMult: 1 + Math.max(0.6, ability.speedBonus), critBonus: 0, stealthBonus: ability.stealthBonus })
    this.player.velocity.add(direction.clone().setY(0).normalize().multiplyScalar(9))
    this.effects.burst(this.player.position, color, 22, 6, 0.5, 0)
  }

  private damageArea(center: THREE.Vector3, radius: number, damage: number, element: ElementId, status?: string, statusSeconds = 0): void {
    for (const enemy of this.spawner.enemies) {
      if (!enemy.alive) continue
      const distance = enemy.position.distanceTo(center)
      if (distance > radius + enemy.radius) continue
      const crit = rollCritical(this.player.effective.critChance)
      const result = enemy.takeDamage(criticalDamage(damage, crit), { element, crit, from: this.player.position })
      if (status) enemy.applyStatus(status as Parameters<Enemy['applyStatus']>[0], statusSeconds, 1)
      this.ui.popDamage(enemy.position.clone().setY(enemy.position.y + enemy.height), String(result.amount), 'magic')
      if (result.killed) this.onEnemyDeath(enemy)
    }
    if (this.boss && !this.boss.dead) {
      const distance = this.boss.position.distanceTo(center)
      if (distance < radius + this.boss.radius) {
        const result = this.boss.takeDamage(damage, { element, from: this.player.position })
        this.ui.popDamage(this.boss.position.clone().setY(this.boss.position.y + 3), String(result.amount), 'magic')
        if (result.killed) this.onBossDeath(this.boss)
      }
    }
  }

  usePotion(): void {
    if (this.mode !== 'playing') return
    const index = this.inventory.stacks.findIndex(stack => stack.id.startsWith('pocao-vida') || stack.id.startsWith('comida'))
    if (index < 0) {
      this.ui.toast('Sem poções de vida', 'warn')
      return
    }
    this.useItem(index)
  }

  useItem(index: number): void {
    const stack = this.inventory.stacks[index]
    if (!stack) return
    const def = itemById(stack.id)
    if (!def) return
    if (def.heal) {
      const healed = this.player.heal(def.heal)
      this.ui.popDamage(this.player.position.clone().setY(this.player.position.y + 2), `+${healed}`, 'heal')
      this.effects.rise(this.player.position, '#8fe0a0', 16, 0.8)
      this.audio.play('heal')
    }
    if (def.manaRestore) this.player.restoreMana(def.manaRestore)
    if (!def.heal && !def.manaRestore && def.kind !== 'comida') {
      this.ui.toast('Este item não pode ser usado agora', 'warn')
      return
    }
    this.inventory.removeAt(index, 1)
    this.ui.refreshPanels()
  }

  // ── world interactions ───────────────────────────────────────────────────
  private updateDiscovery(dt: number): void {
    this.compassTimer -= dt
    for (const poi of this.world.pois.list()) {
      const distance = Math.hypot(poi.x - this.player.position.x, poi.z - this.player.position.z)
      if (poi.discovered || distance > poi.radius + 30) continue
      poi.discovered = true
      this.discovered.add(poi.id)
      this.ui.toast(`Descoberto: ${poi.name}`, 'quest')
      this.audio.play('quest')
      this.quests.progress('chegar', poi.id)
      this.checkQuestReady()
    }
  }

  private updateBossSpawn(dt: number): void {
    void dt
    if (this.boss) return
    for (const poi of this.world.pois.list()) {
      if (!poi.bossId || this.defeatedBosses.has(poi.bossId) || this.discovered.has(`boss:${poi.id}`)) continue
      const distance = Math.hypot(poi.x - this.player.position.x, poi.z - this.player.position.z)
      if (distance > poi.radius + 8) continue
      const def = bossById(poi.bossId)
      if (!def) continue
      this.spawnBoss(def, poi)
      break
    }
  }

  private spawnBoss(def: BossType, poi: Poi): void {
    const boss = new Boss(def, poi.x, poi.z + poi.radius * 0.4, poi.level)
    this.world.scene.add(boss.root)
    this.boss = boss
    this.bossPoi = poi
    const introFlag = `boss-intro:${def.id}`
    if (!this.storyFlags.has(introFlag)) {
      this.storyFlags.add(introFlag)
      this.audio.play('boss')
      this.ui.subtitle(boss.name, boss.def.lore, 6)
      this.ui.toast(`${boss.name} — ${boss.title}`, 'warn')
      this.camera.addShake(0.8)
    }
    this.saveGame(true)
  }

  private updateInteraction(input: GameInput): void {
    if (this.interior) {
      const distance = this.interior.exitPosition.distanceTo(this.player.position)
      this.interactLabel = distance <= 1.65 ? `Sair de ${this.interior.houseName}` : undefined
      if (input.interact && distance <= 1.65) this.exitHouse()
      return
    }
    const nearby = this.population.nearest(this.player.position, 3.4)
    const door = this.world.nearestHouseDoor(this.player.position.x, this.player.position.z, 2.8)
    const doorDistance = door ? Math.hypot(door.x - this.player.position.x, door.z - this.player.position.z) : Infinity
    const nearbyDistance = nearby ? this.interactableDistance(nearby) : Infinity
    const useDoor = Boolean(door && doorDistance <= nearbyDistance)
    this.interactLabel = useDoor && door ? `Entrar em ${door.houseName}` : nearby?.label
    if (!input.interact || (!nearby && !door)) return
    this.audio.play('ui')
    if (useDoor && door) {
      this.enterHouseFromDoor(door)
      return
    }
    if (!nearby) return
    if (nearby.kind === 'npc') this.openNpcDialogue(nearby.npc.def.id)
    else if (nearby.kind === 'chest') {
      const loot = this.population.openChest(nearby.chest, this.skills.effects().lootBonus)
      this.openedChests.add(nearby.chest.id)
      this.inventory.gold += loot.gold
      this.giveLoot(loot.items)
      this.audio.play('open')
      this.ui.toast(`Baú aberto: +${loot.gold} de ouro`, 'item')
      const poiId = nearby.chest.id.split('-bau-')[0]
      this.quests.progress('interagir', poiId)
      this.checkQuestReady()
    } else if (nearby.kind === 'resource') {
      const gathered = this.population.gather(nearby.node)
      if (gathered) {
        const def = itemById(gathered.itemId)
        this.inventory.add(gathered.itemId, gathered.count)
        this.audio.play('pickup')
        this.ui.toast(`+ ${def?.name ?? gathered.itemId} ×${gathered.count}`, 'item')
        this.quests.progress('coletar', gathered.itemId)
        this.quests.syncInventory(this.inventory)
        this.checkQuestReady()
      }
    } else if (nearby.kind === 'station') {
      this.ui.openCraft(this.panelContext(), nearby.station.kind)
      this.mode = 'paused'
      this.onModeChange?.(this.mode)
    } else if (nearby.kind === 'portal') {
      this.spawnPoint.copy(nearby.portal.position).setY(nearby.portal.position.y + 1)
      this.player.safe.copy(this.spawnPoint)
      this.player.heal(this.player.effective.maxHealth)
      this.player.restoreMana(this.player.effective.maxMana)
      this.ui.toast(`Santuário de ${nearby.portal.name} ativado — ponto de retorno atualizado`, 'quest')
      this.audio.play('heal')
      this.saveGame(true)
    }
  }

  private interactableDistance(target: NonNullable<ReturnType<Population['nearest']>>): number {
    switch (target.kind) {
      case 'npc': return target.npc.position.distanceTo(this.player.position)
      case 'chest': return target.chest.position.distanceTo(this.player.position)
      case 'resource': return target.node.position.distanceTo(this.player.position)
      case 'station': return target.station.position.distanceTo(this.player.position)
      case 'portal': return target.portal.position.distanceTo(this.player.position)
    }
  }

  private enterHouseFromDoor(door: HouseDoor): void {
    this.enterHouse(door.houseId, door.houseName, this.player.position.clone(), this.player.facing)
  }

  private enterHouse(houseId: string, houseName: string, returnPosition: THREE.Vector3, returnFacing: number, announce = true): void {
    const room = createHouseInterior(houseId)
    this.interior = {
      houseId,
      houseName,
      returnPosition: returnPosition.clone(),
      returnFacing,
      exitPosition: room.exit.clone(),
    }
    this.world.enterInterior(room, this.player.root)
    this.player.teleport(room.spawn)
    this.player.facing = 0
    this.interactLabel = undefined
    this.camera.reset(this.player.position, this.player.facing)
    this.camera.update(0, this.player.position, { x: 0, y: 0 }, this.world, false, false)
    if (announce) this.ui.toast(`Você entrou em ${houseName}. Pressione E na porta para sair.`, 'item')
    this.saveGame(true)
  }

  private exitHouse(): void {
    const session = this.interior
    if (!session) return
    this.world.exitInterior()
    this.interior = null
    this.player.teleport(session.returnPosition)
    this.player.facing = session.returnFacing
    this.interactLabel = undefined
    this.camera.reset(this.player.position, this.player.facing)
    this.camera.update(0, this.player.position, { x: 0, y: 0 }, this.world, false, false)
    this.audio.play('ui')
    this.ui.toast(`Você saiu de ${session.houseName}.`, 'item')
    this.saveGame(true)
  }

  interactLabel: string | undefined

  markSavedChests(): void {
    for (const chest of this.population.chests) {
      if (!chest.opened && this.openedChests.has(chest.id)) {
        chest.opened = true
        if (chest.light) {
          chest.group.remove(chest.light)
          chest.light = undefined
        }
        chest.lid.rotation.x = 1.9
      }
    }
  }

  // ── dialogue ─────────────────────────────────────────────────────────────
  private updateNpcQuestMarkers(): void {
    for (const npc of this.population.npcs) {
      const { offer, turnIn } = this.quests.forNpc(npc.def.id, this.progression.level)
      npc.setQuestMarker(turnIn.length ? 'turnIn' : offer.length ? 'offer' : null)
    }
  }

  openNpcDialogue(npcId: string): void {
    const def = npcById(npcId)
    if (!def) return
    this.population.npcs.find(npc => npc.def.id === npcId)?.setTalking(true)
    const questState = this.quests.state('principal-01')
    const firstMeeting = npcId === 'iara' && !this.storyFlags.has('iara-intro') && !questState
    const startNode = npcId === 'iara' && !firstMeeting
      ? questState?.status === 'concluida' ? 'aposMissao' : 'retorno'
      : undefined
    if (npcId === 'iara') this.storyFlags.add('iara-intro')
    this.dialogue.open(def, this.quests, this.progression.level, startNode)
    this.quests.progress('falar', npcId)
    this.mode = 'paused'
    this.renderDialogue()
    this.saveGame(true)
  }

  private renderDialogue(): void {
    const npc = this.dialogue.npc
    const node = this.dialogue.node
    if (!npc || !node) {
      this.closeDialogue()
      return
    }
    const views = this.dialogue.choices(this.quests, this.progression.level)
    const offers = this.quests.forNpc(npc.id, this.progression.level).offer
    const turnIns = this.quests.forNpc(npc.id, this.progression.level).turnIn
    this.dialogueOffers = offers
    this.dialogueTurnIns = turnIns
    const choices = [
      ...views.filter(view => view.action !== 'fechar').map(view => ({ text: view.text, kind: view.action === 'aceitar' || view.action === 'concluir' ? 'quest' as const : view.action === 'loja' ? 'shop' as const : view.action === 'curar' ? 'heal' as const : 'normal' as const })),
      ...offers.map(quest => ({ text: `Aceitar missão: ${quest.name}`, kind: 'quest' as const })),
      ...turnIns.map(quest => ({ text: `Concluir missão: ${quest.name}`, kind: 'quest' as const })),
      { text: 'Encerrar conversa', kind: 'normal' as const },
    ]
    this.ui.showDialogue(npc.name, npc.role, node.text, choices, index => this.onDialogueChoice(index, views.length))
  }

  private onDialogueChoice(index: number, nodeChoiceCount: number): void {
    const npc = this.dialogue.npc
    if (!npc) return
    if (index < nodeChoiceCount) {
      const result = this.dialogue.select(index, this.quests, this.progression.level)
      if (result.action === 'aceitar' && result.quest) this.acceptQuest(result.quest)
      else if (result.action === 'concluir' && result.quest) this.turnInQuest(result.quest)
      else if (result.action === 'loja') {
        this.closeDialogue()
        this.openShop(npc.shop ?? 'geral')
        return
      } else if (result.action === 'curar') {
        if (this.inventory.gold < 25) this.ui.toast('Precisa de 25 de ouro', 'warn')
        else {
          this.inventory.gold -= 25
          this.player.heal(this.player.effective.maxHealth)
          this.player.restoreMana(this.player.effective.maxMana)
          this.audio.play('heal')
          this.ui.toast('Ferimentos tratados', 'item')
        }
      } else if (result.action === 'forja') {
        this.closeDialogue()
        this.ui.openCraft(this.panelContext(), 'forja')
        this.mode = 'paused'
        return
      }
      if (result.close) {
        this.closeDialogue()
        return
      }
      this.renderDialogue()
      return
    }
    const offerIndex = index - nodeChoiceCount
    if (offerIndex < this.dialogueOffers.length) {
      this.acceptQuest(this.dialogueOffers[offerIndex].id)
      this.renderDialogue()
      return
    }
    const turnInIndex = offerIndex - this.dialogueOffers.length
    if (turnInIndex < this.dialogueTurnIns.length) {
      this.turnInQuest(this.dialogueTurnIns[turnInIndex].id)
      this.renderDialogue()
      return
    }
    this.closeDialogue()
  }

  private acceptQuest(id: string): void {
    const error = this.quests.accept(id, this.progression.level)
    if (error) {
      this.ui.toast(error, 'warn')
      return
    }
    const quest = questById(id)
    this.ui.toast(`Missão aceita: ${quest?.name ?? id}`, 'quest')
    this.audio.play('quest')
    this.quests.tracked = id
    this.quests.syncInventory(this.inventory)
    this.saveGame(true)
  }

  private turnInQuest(id: string): void {
    const quest = questById(id)
    const reward = this.quests.complete(id)
    if (!quest || !reward) {
      this.ui.toast('Objetivos incompletos', 'warn')
      return
    }
    this.grantXp(reward.xp)
    this.inventory.gold += reward.gold
    for (const item of reward.items ?? []) {
      const def = itemById(item.itemId)
      this.inventory.add(item.itemId, item.count)
      this.ui.toast(`+ ${def?.name ?? item.itemId} ×${item.count}`, 'item')
    }
    this.audio.play('win')
    this.ui.toast(`Missão concluída: ${quest.name} · +${reward.xp} XP · +${reward.gold} ouro`, 'level')
    this.saveGame(true)
  }

  closeDialogue(): void {
    const npcId = this.dialogue.npc?.id
    if (npcId) this.population.npcs.find(npc => npc.def.id === npcId)?.setTalking(false)
    this.ui.hideDialogue()
    this.dialogue.close()
    this.mode = 'playing'
    this.onModeChange?.(this.mode)
    this.deps.onResumeRequest()
  }

  openShop(id: ShopId): void {
    this.shop = shopFor(id)
    this.mode = 'paused'
    this.onModeChange?.(this.mode)
    this.ui.openShop(this.panelContext(), this.shop)
  }

  // ── panels ───────────────────────────────────────────────────────────────
  panelContext(): PanelContext {
    return {
      inventory: this.inventory,
      progression: this.progression,
      skills: this.skills,
      quests: this.quests,
      stats: this.player.effective,
      bonus: this.inventory.bonus() as unknown as Record<string, number>,
      pois: this.world.pois.list(),
      player: { x: this.player.position.x, z: this.player.position.z, yaw: this.camera.yaw },
      mapCanvas: this.mapCanvas,
      settings: this.save.data.settings,
      actions: this.panelActions,
    }
  }

  ensureMap(): HTMLCanvasElement {
    if (!this.mapCanvas) this.mapCanvas = generateWorldMap(this.world)
    return this.mapCanvas
  }

  openPanel(kind: 'inventario' | 'habilidades' | 'mapa' | 'missoes'): void {
    if (this.mode !== 'playing') return
    this.mode = 'paused'
    this.onModeChange?.(this.mode)
    const ctx = this.panelContext()
    if (kind === 'mapa') ctx.mapCanvas = this.ensureMap()
    if (kind === 'inventario') this.ui.openInventory(ctx)
    else if (kind === 'habilidades') this.ui.openSkills(ctx)
    else if (kind === 'mapa') this.ui.openMap(ctx)
    else this.ui.openQuests(ctx)
  }

  private buildPanelActions(): PanelActions {
    return {
      equip: index => {
        const error = this.inventory.equipIndex(index, this.progression.level)
        if (error) this.ui.toast(error, 'warn')
        else {
          this.audio.play('ui')
          this.refreshStats()
        }
        this.ui.refreshPanels()
      },
      unequip: slot => {
        const error = this.inventory.unequip(slot)
        if (error) this.ui.toast(error, 'warn')
        this.refreshStats()
        this.ui.refreshPanels()
      },
      useItem: index => this.useItem(index),
      upgrade: index => {
        const stack = this.inventory.stacks[index]
        if (!stack) return
        const error = this.inventory.upgradeStack(stack)
        if (error) this.ui.toast(error, 'warn')
        else {
          this.audio.play('block')
          this.refreshStats()
        }
        this.ui.refreshPanels()
      },
      drop: index => {
        this.inventory.removeAt(index, 1)
        this.ui.refreshPanels()
      },
      sell: index => {
        if (!this.shop) return
        const error = this.shop.sell(index, this.inventory)
        if (error) this.ui.toast(error, 'warn')
        else this.audio.play('coin')
        this.ui.refreshPanels()
      },
      buy: itemId => {
        if (!this.shop) return
        const error = this.shop.buy(itemId, this.inventory, this.progression.level)
        if (error) this.ui.toast(error, 'warn')
        else this.audio.play('coin')
        this.ui.refreshPanels()
      },
      craft: recipeId => {
        const recipe = recipeById(recipeId)
        if (!recipe) return
        const error = craftRecipe(recipe, this.inventory, this.progression.level)
        if (error) this.ui.toast(error, 'warn')
        else {
          this.audio.play('open')
          const def = itemById(recipe.output.itemId)
          this.ui.toast(`Criado: ${def?.name ?? recipe.output.itemId}`, 'item')
          this.quests.progress('fabricar', recipe.output.itemId)
          this.quests.syncInventory(this.inventory)
          this.checkQuestReady()
        }
        this.ui.refreshPanels()
      },
      spendPoint: attribute => {
        if (this.progression.spendPoint(attribute as AttributeKey)) {
          this.refreshStats()
          this.audio.play('ui')
        }
        this.ui.refreshPanels()
      },
      rankSkill: id => {
        if (this.skills.rankUp(id)) {
          this.progression.skillPoints -= 1
          this.refreshStats()
          this.audio.play('levelup')
        }
        this.ui.refreshPanels()
      },
      fastTravel: poiId => {
        const poi = this.world.pois.byId(poiId)
        if (!poi || !poi.discovered) return
        this.ui.closePanels()
        this.mode = 'playing'
        const y = this.world.groundAt(poi.x, poi.z + poi.radius * 0.6, 200)
        this.player.teleport(new THREE.Vector3(poi.x, y + 1, poi.z + poi.radius * 0.6))
        this.camera.reset(this.player.position, this.player.facing)
        this.ui.toast(`Viajou para ${poi.name}`, 'quest')
        this.audio.play('cast')
        this.onModeChange?.(this.mode)
        this.deps.onResumeRequest()
      },
      trackQuest: id => {
        this.quests.tracked = id
        this.ui.refreshPanels()
      },
      close: () => {
        this.ui.closePanels()
        this.mode = 'playing'
        this.onModeChange?.(this.mode)
        this.deps.onResumeRequest()
      },
      save: () => {
        this.saveGame(true)
        this.ui.toast('Progresso salvo', 'item')
      },
      quit: () => {
        this.saveGame(true)
        this.deps.onQuit()
      },
      respawn: () => this.respawn(),
      settings: patch => {
        this.save.updateSettings(patch)
        this.applySettings(this.save.data.settings)
        this.ui.refreshPanels()
      },
      dialogue: index => this.onDialogueChoice(index, this.dialogue.choices(this.quests, this.progression.level).length),
    }
  }

  private bindHud(): void {
    this.ui.bindHud(
      element => this.selectElement(element),
      index => this.castAbility(index),
      () => this.usePotion(),
      () => this.openPanel('missoes'),
    )
  }

  private findHuntWaypoint(targetId: string, biomes: readonly BiomeId[]): BiomeWaypoint | null {
    const position = this.player.position
    const cached = this.huntWaypointCache
    if (!cached || cached.targetId !== targetId || Math.hypot(position.x - cached.originX, position.z - cached.originZ) > 120) {
      const waypoint = this.world.terrain.nearestWalkableBiome(
        position.x,
        position.z,
        biomes,
        900,
        (x, z) => this.world.pois.isBlocked(x, z),
      )
      this.huntWaypointCache = { targetId, originX: position.x, originZ: position.z, waypoint }
    }
    return this.huntWaypointCache?.waypoint ?? null
  }

  // ── stats and save ───────────────────────────────────────────────────────
  refreshStats(): void {
    const effects = this.skills.effects()
    const bonus = this.inventory.bonus() as StatBonus
    const stats = derivedStats(this.progression.attributes, this.progression.level, {
      ...bonus,
      ataque: bonus.ataque * (1 + effects.physicalDamage),
      magia: bonus.magia * (1 + effects.magicDamage),
      critico: bonus.critico + effects.critBonus * 100,
      rouboDeVida: bonus.rouboDeVida + effects.lifesteal * 100,
      stamina: bonus.stamina + effects.staminaBonus,
      mana: bonus.mana + effects.manaBonus,
      defesa: bonus.defesa * (1 + effects.defenseBonus),
      furtividade: bonus.furtividade + effects.stealth * 100,
      velocidade: bonus.velocidade * (1 + effects.moveSpeed),
    })
    this.pendingStats = stats
    this.player.setStats(stats)
    this.player.setWeapon(this.inventory.weapon())
    this.player.model.setEquipment({
      weapon: this.inventory.weapon(),
      armor: Boolean(this.inventory.equipment.armadura),
      helmet: Boolean(this.inventory.equipment.capacete),
      boots: Boolean(this.inventory.equipment.botas),
      rarity: this.inventory.equippedDef('arma')?.rarity,
    })
  }

  saveGame(quiet = false): void {
    const savePosition = this.interior?.returnPosition ?? this.player.position
    const saveFacing = this.interior?.returnFacing ?? this.player.facing
    const data: GameSave = {
      seed: this.world.seed,
      position: [savePosition.x, savePosition.y, savePosition.z],
      facing: saveFacing,
      playtime: this.playtime,
      timeOfDay: this.world.sky.timeOfDay,
      progression: this.progression.toJSON(),
      inventory: this.inventory.toJSON() as unknown as GameSave['inventory'],
      skills: this.skills.toJSON(),
      quests: this.quests.toJSON(),
      discovered: [...this.discovered, ...[...this.defeatedBosses].map(id => `boss:${id}`)],
      openedChests: [...this.openedChests],
      storyFlags: [...this.storyFlags],
      interior: this.interior ? { houseId: this.interior.houseId, houseName: this.interior.houseName } : null,
      deaths: this.deaths,
      kills: this.kills,
      createdAt: this.save.data.game?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    }
    this.save.saveGame(data)
    if (!quiet) this.ui.toast('Progresso salvo', 'item')
  }

  private loadFrom(data: GameSave): void {
    this.progression.load(data.progression as unknown as Parameters<Progression['load']>[0])
    this.inventory.load(data.inventory as unknown as Parameters<Inventory['load']>[0])
    this.skills.load(data.skills)
    this.quests.load(data.quests)
    this.storyFlags.clear()
    for (const flag of data.storyFlags ?? []) this.storyFlags.add(flag)
    this.discovered.clear()
    for (const id of data.discovered) {
      if (id.startsWith('boss:')) this.defeatedBosses.add(id.slice(5))
      else this.discovered.add(id)
    }
    for (const id of data.openedChests) this.openedChests.add(id)
    for (const poi of this.world.pois.list()) {
      if (this.discovered.has(poi.id)) poi.discovered = true
    }
    this.kills = data.kills
    this.deaths = data.deaths
    this.playtime = data.playtime
    this.spawnPoint.set(data.position[0], data.position[1], data.position[2])
    this.quests.syncInventory(this.inventory)
  }

  // ── HUD ──────────────────────────────────────────────────────────────────
  private updateTarget(): void {
    let best: Enemy | null = null
    let bestDistance = 26
    const forward = this.camera.forward
    for (const enemy of this.spawner.enemies) {
      if (!enemy.alive) continue
      const dx = enemy.position.x - this.player.position.x
      const dz = enemy.position.z - this.player.position.z
      const distance = Math.hypot(dx, dz)
      if (distance > bestDistance) continue
      const dot = distance < 0.3 ? 1 : (dx / distance) * forward.x + (dz / distance) * forward.z
      if (dot < 0.35 && !enemy.aggro) continue
      bestDistance = distance
      best = enemy
    }
    this.target = best ? this.enemyTarget(best) : null
    this.targetEnemy = best
  }

  private targetEnemy: Enemy | null = null

  private updateHud(dt: number): void {
    const abilities: HudAbility[] = this.abilities().map((ability, index) => ({
      id: ability.id,
      name: ability.name,
      element: ability.element,
      tier: ability.tier,
      cooldown: this.player.cooldownLeft(ability.id),
      total: ability.cooldown,
      mana: ability.mana,
      locked: !abilityUnlocked(ability, this.progression.level),
      key: ['Z', 'X', 'C'][index] ?? '?',
    }))
    const trackedId = this.quests.tracked
    const tracked = trackedId && this.quests.state(trackedId)?.status === 'ativa' ? questById(trackedId) : undefined
    const questReady = tracked ? this.quests.ready(tracked.id) : false
    const questGiver = tracked ? this.population.npcs.find(npc => npc.def.id === tracked.giver) : undefined
    const trackedObjectiveIndex = tracked
      ? tracked.objectives.findIndex(objective => this.quests.objectiveProgress(tracked.id, objective.id) < objective.count)
      : -1
    const trackedObjective = tracked && trackedObjectiveIndex >= 0 ? tracked.objectives[trackedObjectiveIndex] : undefined
    const trackedObjectiveProgress = tracked && trackedObjective
      ? Math.min(trackedObjective.count, this.quests.objectiveProgress(tracked.id, trackedObjective.id))
      : 0
    const objectiveNpc = trackedObjective?.kind === 'falar'
      ? this.population.npcs.find(npc => npc.def.id === trackedObjective.target)
      : undefined
    const objectiveEnemy = trackedObjective?.kind === 'matar'
      ? this.spawner.enemies.reduce<Enemy | undefined>((nearest, enemy) => {
        if (!enemy.alive || enemy.def.id !== trackedObjective.target) return nearest
        if (!nearest) return enemy
        const enemyDistance = enemy.position.distanceToSquared(this.player.position)
        const nearestDistance = nearest.position.distanceToSquared(this.player.position)
        return enemyDistance < nearestDistance ? enemy : nearest
      }, undefined)
      : undefined
    const objectiveEnemyType = trackedObjective?.kind === 'matar' ? enemyById(trackedObjective.target) : undefined
    const huntWaypoint = objectiveEnemyType && !objectiveEnemy
      ? this.findHuntWaypoint(objectiveEnemyType.id, objectiveEnemyType.biomes)
      : null
    const huntLocator = objectiveEnemyType
      ? objectiveEnemy
        ? `${objectiveEnemy.displayName} mais próximo · ${Math.round(Math.hypot(objectiveEnemy.position.x - this.player.position.x, objectiveEnemy.position.z - this.player.position.z))} m`
        : huntWaypoint
          ? `Zona de caça · ${BIOMES[huntWaypoint.biome].name} · ${Math.round(Math.hypot(huntWaypoint.x - this.player.position.x, huntWaypoint.z - this.player.position.z))} m${objectiveEnemyType.nocturnal && this.world.sky.night < 0.45 ? ' · aparece à noite' : ''}`
          : `Habitat: ${objectiveEnemyType.biomes.map(biomeId => BIOMES[biomeId].name).join(' ou ')}`
      : undefined
    const objectivePoiId = trackedObjective && ['interagir', 'chegar'].includes(trackedObjective.kind)
      ? trackedObjective.target
      : tracked?.marker
    const objectivePoi = trackedObjective?.kind === 'chefe'
      ? this.world.pois.list().find(poi => poi.bossId === trackedObjective.target)
      : objectivePoiId ? this.world.pois.list().find(poi => poi.id === objectivePoiId) : undefined
    const questPoiId = questReady ? undefined : objectivePoi?.id ?? (!objectiveNpc && !objectiveEnemy && !huntWaypoint ? tracked?.marker : undefined)
    const quest = tracked
      ? {
        name: tracked.name,
        progress: questReady
          ? `Entrega pendente · ${tracked.objectives.length}/${tracked.objectives.length} etapas`
          : `Etapa ${trackedObjectiveIndex + 1}/${tracked.objectives.length} · ${trackedObjectiveProgress}/${trackedObjective?.count ?? 0}`,
        objective: questReady
          ? `Volte e fale com ${questGiver?.def.name ?? 'quem passou a missão'} para entregar.`
          : trackedObjective?.label ?? 'Objetivos concluídos. Volte para entregar a missão.',
        reward: `Recompensa: +${tracked.rewards.xp} XP · +${tracked.rewards.gold} ouro${tracked.rewards.items?.length
          ? ` · ${tracked.rewards.items.map(item => `${item.count}× ${itemById(item.itemId)?.name ?? 'item'}`).join(' · ')}`
          : ''}`,
        ready: questReady,
        locator: huntLocator,
      }
      : undefined
    const questPois: HudPoi[] = this.world.pois.list().map(poi => ({
      x: poi.x,
      z: poi.z,
      kind: poi.kind,
      name: poi.name,
      discovered: poi.discovered || Boolean(tracked && poi.id === questPoiId),
      boss: Boolean(poi.bossId),
      quest: Boolean(tracked && poi.id === questPoiId),
    }))
    const waypointNpc = questReady ? questGiver : objectiveNpc
    if (tracked && waypointNpc) {
      questPois.push({
        x: waypointNpc.position.x,
        z: waypointNpc.position.z,
        kind: 'quest-npc',
        name: waypointNpc.def.name,
        discovered: true,
        boss: false,
        quest: true,
      })
    } else if (tracked && objectiveEnemy) {
      questPois.push({
        x: objectiveEnemy.position.x,
        z: objectiveEnemy.position.z,
        kind: 'quest-enemy',
        name: objectiveEnemy.displayName,
        discovered: true,
        boss: false,
        quest: true,
      })
    } else if (tracked && objectiveEnemyType && huntWaypoint) {
      questPois.push({
        x: huntWaypoint.x,
        z: huntWaypoint.z,
        kind: 'quest-hunt',
        name: objectiveEnemyType.name,
        discovered: true,
        boss: false,
        quest: true,
      })
    } else if (tracked && objectivePoi) {
      questPois.push({
        x: objectivePoi.x,
        z: objectivePoi.z,
        kind: objectivePoi.kind,
        name: objectivePoi.name,
        discovered: true,
        boss: Boolean(objectivePoi.bossId),
        quest: true,
      })
    }
    const biome = this.world.biomeAt(this.player.position.x, this.player.position.z)
    const nearPoi = this.world.pois.nearest(this.player.position.x, this.player.position.z, poi => Math.hypot(poi.x - this.player.position.x, poi.z - this.player.position.z) < poi.radius + 20)
    const time = this.world.sky.timeOfDay
    const hours = Math.floor(time * 24)
    const minutes = Math.floor((time * 24 - hours) * 60)
    const boss = this.boss
    const target = this.targetEnemy
    const snapshot: HudSnapshot = {
      health: this.player.health,
      maxHealth: this.player.effective.maxHealth,
      mana: this.player.mana,
      maxMana: this.player.effective.maxMana,
      stamina: this.player.stamina,
      maxStamina: this.player.effective.maxStamina,
      level: this.progression.level,
      playerName: this.save.data.profile.name || 'O Marcado',
      xpRatio: this.progression.xpRatio,
      gold: this.inventory.gold,
      abilities,
      element: this.player.element,
      potions: this.inventory.count('pocao-vida-1') + this.inventory.count('pocao-vida-2') + this.inventory.count('pocao-vida-3'),
      quest,
      boss: boss
        ? { name: boss.name, title: boss.title, healthRatio: boss.healthRatio, phase: boss.phase.name, phases: 3 }
        : undefined,
      target: target
        ? { name: target.displayName, level: target.level, healthRatio: target.health / target.maxHealth, status: target.statusLabel, elite: target.elite }
        : undefined,
      prompt: this.interactLabel,
      location: nearPoi ? nearPoi.name : BIOMES[biome].name,
      region: BIOMES[biome].name,
      weather: WEATHER_LABEL[this.world.weather.state] ?? 'Céu limpo',
      clock: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      night: this.world.sky.night > 0.5,
      buffs: this.player.buffs.map(buff => ({ name: buff.name, seconds: buff.seconds })),
      fps: this.fps,
      yaw: this.camera.yaw,
      player: { x: this.player.position.x, z: this.player.position.z },
      pois: questPois,
      sample: (x, z) => ({ height: this.world.heightAt(x, z), biome: this.world.biomeAt(x, z) }),
      enemies: this.spawner.enemies.filter(enemy => enemy.aggro && enemy.alive).slice(0, 24).map(enemy => ({ x: enemy.position.x, z: enemy.position.z })),
    }
    this.ui.renderHud(snapshot, dt, this.camera.camera, window.innerWidth, window.innerHeight)
  }

  fps = 60

  setFps(fps: number): void {
    this.fps = fps
  }

  get position(): THREE.Vector3 {
    return this.player.position
  }
}

function statusForElement(element: ElementId): Parameters<Enemy['applyStatus']>[0] {
  switch (element) {
    case 'fogo': return 'queimando'
    case 'gelo': return 'congelado'
    case 'raio': return 'eletrificado'
    case 'vento': return 'lento'
    case 'sombra': return 'enfraquecido'
    default: return 'sangrando'
  }
}

export { buyPrice, sellPrice, clamp, damp }
