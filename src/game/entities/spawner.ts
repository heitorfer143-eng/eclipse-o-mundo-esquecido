import type { BiomeId, EnemyType } from '../data/types'
import { ENEMIES } from '../data/enemyData'
import { clamp } from '../core/math'
import type { Quality } from '../../engine/save'
import { Enemy, type EnemySpawn } from './enemy'

const CAP: Record<Quality, number> = { low: 12, medium: 18, high: 26 }

export type SpawnContext = {
  playerPosition: THREE.Vector3
  biome: BiomeId
  night: number
  level: number
  isBlocked: (x: number, z: number) => boolean
  groundAt: (x: number, z: number, feetY: number) => number
  isWater: (x: number, z: number) => boolean
}

import type * as THREE from 'three'

/** Chooses a creature whose biome and level window match the location. */
export function pickEnemyFor(biome: BiomeId, level: number, night: number, requiredId?: EnemyType['id']): EnemyType | undefined {
  if (requiredId) {
    const required = ENEMIES.find(enemy => enemy.id === requiredId)
    if (required) return required
  }
  const candidates = ENEMIES.filter(enemy => {
    if (!enemy.biomes.includes(biome)) return false
    if (level < enemy.minLevel - 1 || level > enemy.maxLevel + 2) return false
    if (enemy.nocturnal && night < 0.45) return false
    return true
  })
  if (!candidates.length) {
    const fallback = ENEMIES.filter(enemy => enemy.minLevel <= level + 2)
    return fallback[Math.floor(Math.random() * fallback.length)]
  }
  return candidates[Math.floor(Math.random() * candidates.length)]
}

/** Keeps the wilderness populated around the player and culls distant creatures. */
export class Spawner {
  readonly enemies: Enemy[] = []
  private timer = 3
  private readonly cap: number

  constructor(private readonly scene: THREE.Scene, quality: Quality) {
    this.cap = CAP[quality]
  }

  add(spawn: EnemySpawn): Enemy {
    const enemy = new Enemy(spawn)
    if (spawn.spawnId) enemy.root.userData.spawnId = spawn.spawnId
    this.scene.add(enemy.root)
    this.enemies.push(enemy)
    return enemy
  }

  update(dt: number, ctx: SpawnContext): void {
    // Remove completed corpses before checking the cap; nearby bodies must not block respawn.
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i]
      const distance = Math.hypot(enemy.position.x - ctx.playerPosition.x, enemy.position.z - ctx.playerPosition.z)
      if (enemy.finished || (distance > 130 && (!enemy.aggro || enemy.dead))) {
        enemy.dispose()
        this.enemies.splice(i, 1)
      }
    }

    this.timer -= dt
    if (this.timer <= 0 && this.enemies.length < this.cap) {
      this.timer = 2.2 + Math.random() * 3
      const count = 1 + (Math.random() < 0.35 ? 1 : 0)
      for (let i = 0; i < count; i += 1) {
        if (this.enemies.length >= this.cap) break
        const angle = Math.random() * Math.PI * 2
        const distance = 48 + Math.random() * 34
        const x = ctx.playerPosition.x + Math.cos(angle) * distance
        const z = ctx.playerPosition.z + Math.sin(angle) * distance
        if (ctx.isBlocked(x, z) || ctx.isWater(x, z)) continue
        const ground = ctx.groundAt(x, z, 60)
        if (ground < 0.5) continue
        const def = pickEnemyFor(ctx.biome, ctx.level, ctx.night)
        if (!def) continue
        const level = clamp(Math.round(ctx.level + (Math.random() * 4 - 2)), Math.max(1, def.minLevel), Math.max(def.minLevel, def.maxLevel))
        this.add({ def, level, x, z, elite: Math.random() < 0.06 })
      }
    }

  }

  remove(enemy: Enemy): void {
    const index = this.enemies.indexOf(enemy)
    if (index >= 0) this.enemies.splice(index, 1)
    enemy.dispose()
  }

  hasSpawn(spawnId: string): boolean {
    return this.enemies.some(enemy => enemy.root.userData.spawnId === spawnId)
  }

  removeSpawn(spawnId: string): void {
    const enemy = this.enemies.find(entry => entry.root.userData.spawnId === spawnId)
    if (enemy) this.remove(enemy)
  }

  clear(): void {
    for (const enemy of this.enemies) enemy.dispose()
    this.enemies.length = 0
  }

  get count(): number {
    return this.enemies.length
  }
}
