import * as THREE from 'three'
import type { BiomeId } from '../data/types'
import type { Quality } from '../../engine/save'
import { CHUNK_SIZE, ChunkManager } from './chunks'
import { collidersNearPoint, supportHeight, type Collider } from './collision'
import { BIOMES } from './biomes'
import { PoiManager, SPAWN_POINT, type Poi } from './poi'
import { Sky } from './sky'
import { SEA_LEVEL, Terrain } from './terrain'
import { Water } from './water'
import { Weather } from './weather'

const VIEW_RADIUS: Record<Quality, number> = { low: 3, medium: 4, high: 5 }

/** Owns the scene: terrain streaming, settlements, sky, water and weather. */
export class World {
  readonly scene = new THREE.Scene()
  readonly terrain: Terrain
  readonly chunks: ChunkManager
  readonly pois: PoiManager
  readonly sky: Sky
  readonly water: Water
  readonly weather: Weather
  readonly spawn = new THREE.Vector3()
  private readonly colliders: Collider[] = []
  private colliderX = Number.NaN
  private colliderZ = Number.NaN
  private readonly poiColliders: Collider[] = []
  private streamTimer = 0

  constructor(readonly seed: number, quality: Quality) {
    this.terrain = new Terrain(seed)
    this.pois = new PoiManager(this.terrain, seed)
    this.chunks = new ChunkManager(this.terrain, (x, z) => this.pois.isBlocked(x, z), VIEW_RADIUS[quality])
    this.scene.add(this.chunks.group, this.pois.group)
    this.sky = new Sky(this.scene)
    this.water = new Water(this.scene)
    this.weather = new Weather(this.scene)
    this.spawn.copy(this.findSpawn())
    this.chunks.prime(this.spawn.x, this.spawn.z, 2)
    this.pois.update(this.spawn.x, this.spawn.z, 3)
  }

  /** A dry, gentle forest clearing near the story start. */
  private findSpawn(): THREE.Vector3 {
    for (let radius = 0; radius < 260; radius += 8) {
      for (let i = 0; i < 12; i += 1) {
        const angle = (i / 12) * Math.PI * 2 + radius * 0.02
        const x = SPAWN_POINT.x + Math.cos(angle) * radius
        const z = SPAWN_POINT.z + Math.sin(angle) * radius
        const height = this.terrain.heightAt(x, z)
        if (height < SEA_LEVEL + 4) continue
        if (this.terrain.slopeAt(x, z) > 0.4) continue
        const biome = this.terrain.biomeAt(x, z, height)
        if (biome === 'floresta' || biome === 'floresta-densa' || biome === 'planicie') return new THREE.Vector3(x, height + 0.2, z)
      }
    }
    return new THREE.Vector3(SPAWN_POINT.x, this.terrain.heightAt(SPAWN_POINT.x, SPAWN_POINT.z) + 0.2, SPAWN_POINT.z)
  }

  setQuality(quality: Quality): void {
    this.sky.setQuality(quality === 'low' ? 512 : quality === 'medium' ? 1024 : 2048)
  }

  heightAt(x: number, z: number): number {
    return this.terrain.heightAt(x, z)
  }

  biomeAt(x: number, z: number): BiomeId {
    return this.terrain.biomeAt(x, z)
  }

  get biomeName(): string {
    return BIOMES[this.terrain.biomeAt(this.playerX, this.playerZ)].name
  }

  playerX = 0
  playerZ = 0

  isWater(x: number, z: number): boolean {
    return this.terrain.heightAt(x, z) < SEA_LEVEL - 0.2
  }

  waterDepth(x: number, z: number): number {
    return Math.max(0, SEA_LEVEL - this.terrain.heightAt(x, z))
  }

  /** Refresh the collider set around a position (cached until the player moves). */
  private refreshColliders(x: number, z: number): void {
    if (Math.abs(x - this.colliderX) < 3 && Math.abs(z - this.colliderZ) < 3) return
    this.colliderX = x
    this.colliderZ = z
    this.colliders.length = 0
    this.chunks.collidersNear(x, z, this.poiColliders)
    this.colliders.push(...this.poiColliders)
    this.pois.collidersNear(x, z, this.poiColliders)
    this.colliders.push(...this.poiColliders)
  }

  collidersNear(x: number, z: number): readonly Collider[] {
    this.refreshColliders(x, z)
    return this.colliders
  }

  /** Walkable surface height (terrain or a building floor) under a position. */
  groundAt(x: number, z: number, feetY: number): number {
    const terrain = this.terrain.heightAt(x, z)
    const colliders = this.collidersNear(x, z)
    return supportHeight(x, z, feetY, terrain, colliders)
  }

  /** Colliders from a wider radius, used by projectiles and area attacks. */
  collidersAround(x: number, z: number, radius: number): Collider[] {
    const out: Collider[] = []
    collidersNearPoint(this.chunks.collidersNear(x, z, []), x, z, radius, out)
    collidersNearPoint(this.pois.collidersNear(x, z, []), x, z, radius, out)
    return out
  }

  poiAt(x: number, z: number): Poi | undefined {
    return this.pois.at(x, z)
  }

  nearestPoi(x: number, z: number, filter?: (poi: Poi) => boolean): Poi | undefined {
    return this.pois.nearest(x, z, filter)
  }

  /** One render-frame update: stream chunks and settlements, move the sky and weather. */
  update(dt: number, camera: THREE.PerspectiveCamera, player: THREE.Vector3): void {
    this.playerX = player.x
    this.playerZ = player.z
    this.streamTimer += dt
    // Build at most one chunk and one settlement per 0.1 s to avoid frame spikes.
    if (this.streamTimer > 0.08) {
      this.streamTimer = 0
      this.chunks.update(player.x, player.z, 1)
      this.pois.update(player.x, player.z, 1)
    }
    const biome = this.terrain.biomeAt(player.x, player.z)
    this.sky.update(dt, camera, player)
    this.weather.update(dt, camera, biome, this.sky.night)
    this.sky.setWeather(this.weather.fog, this.weather.state === 'limpo' ? null : this.weather.tintColor)
    this.water.update(dt, camera, this.sky.sunDirection, this.sky.sun.color, this.sky.night, this.sky.horizonColor)
  }

  /** Fast travel target: the nearest shrine or city portal. */
  nearestPortal(x: number, z: number): Poi | undefined {
    return this.pois.nearest(x, z, poi => poi.kind === 'santuario' || poi.kind === 'cidade' || poi.kind === 'vila' || poi.kind === 'porto' || poi.kind === 'torre')
  }

  chunkBounds(): number {
    return CHUNK_SIZE
  }
}
