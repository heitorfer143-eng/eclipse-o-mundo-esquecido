import * as THREE from 'three'
import type { BiomeId } from '../data/types'
import { clamp, smoothstep } from '../core/math'
import { BIOMES } from './biomes'

export type WeatherState = 'limpo' | 'nublado' | 'chuva' | 'tempestade' | 'neblina' | 'neve' | 'areia' | 'cinzas'

const STATE_INFO: Record<WeatherState, { fog: number; tint: string; size: number; opacity: number; speed: number; color: string }> = {
  limpo: { fog: 0, tint: '#ffffff', size: 1, opacity: 0, speed: 0, color: '#ffffff' },
  nublado: { fog: 0.0012, tint: '#b9c3cf', size: 1, opacity: 0, speed: 0, color: '#ffffff' },
  chuva: { fog: 0.0028, tint: '#7f93a6', size: 1.6, opacity: 0.55, speed: 34, color: '#bcd4e8' },
  tempestade: { fog: 0.0045, tint: '#4d5a6c', size: 2.1, opacity: 0.75, speed: 52, color: '#c8dcef' },
  neblina: { fog: 0.012, tint: '#c8cfd6', size: 1, opacity: 0, speed: 0, color: '#ffffff' },
  neve: { fog: 0.005, tint: '#dbe6f2', size: 2.4, opacity: 0.85, speed: 5.5, color: '#ffffff' },
  areia: { fog: 0.007, tint: '#d9b878', size: 2.2, opacity: 0.6, speed: 24, color: '#e8cd93' },
  cinzas: { fog: 0.004, tint: '#7a6f74', size: 2, opacity: 0.5, speed: 7, color: '#9c8f8a' },
}

const PARTICLES = 2200
const AREA = 46
const HEIGHT = 26

/** Drives rain/snow/sand particles, fog and lightning, changing with biome and time. */
export class Weather {
  state: WeatherState = 'limpo'
  private target: WeatherState = 'limpo'
  private blend = 0
  private time = 0
  private changeIn = 60
  private readonly points: THREE.Points
  private readonly material: THREE.PointsMaterial
  private readonly rainStreaks: THREE.LineSegments
  private readonly rainMaterial: THREE.LineBasicMaterial
  private readonly positions: Float32Array
  private readonly streakPositions: Float32Array
  private readonly velocities: Float32Array
  private fogAmount = 0
  private tint = new THREE.Color('#ffffff')
  private lightningIn = 6
  /** 0..1 flash intensity consumed by the game to brighten the scene. */
  flash = 0
  onThunder?: () => void
  onStateChange?: (state: WeatherState) => void

  constructor(scene: THREE.Scene) {
    this.positions = new Float32Array(PARTICLES * 3)
    this.streakPositions = new Float32Array(PARTICLES * 6)
    this.velocities = new Float32Array(PARTICLES * 3)
    for (let i = 0; i < PARTICLES; i += 1) {
      this.positions[i * 3] = (Math.random() - 0.5) * AREA
      this.positions[i * 3 + 1] = Math.random() * HEIGHT
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * AREA
      this.velocities[i * 3] = 0
      this.velocities[i * 3 + 1] = -20 - Math.random() * 15
      this.velocities[i * 3 + 2] = 0
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.material = new THREE.PointsMaterial({ color: '#bcd4e8', size: 1.6, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true, fog: false })
    this.points = new THREE.Points(geometry, this.material)
    this.points.frustumCulled = false
    this.points.renderOrder = 5
    scene.add(this.points)

    const rainGeometry = new THREE.BufferGeometry()
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(this.streakPositions, 3))
    this.rainMaterial = new THREE.LineBasicMaterial({ color: '#bcd4e8', transparent: true, opacity: 0, depthWrite: false, fog: false })
    this.rainStreaks = new THREE.LineSegments(rainGeometry, this.rainMaterial)
    this.rainStreaks.frustumCulled = false
    this.rainStreaks.renderOrder = 5
    scene.add(this.rainStreaks)
  }

  get label(): string {
    switch (this.state) {
      case 'limpo': return 'Céu limpo'
      case 'nublado': return 'Nublado'
      case 'chuva': return 'Chuva'
      case 'tempestade': return 'Tempestade'
      case 'neblina': return 'Neblina densa'
      case 'neve': return 'Nevando'
      case 'areia': return 'Tempestade de areia'
      case 'cinzas': return 'Chuva de cinzas'
    }
  }

  /** Force a state (used by the story and boss arenas). */
  set(state: WeatherState, immediate = false): void {
    this.target = state
    if (immediate) {
      this.state = state
      this.blend = 1
      this.applyState()
    }
    this.changeIn = 120 + Math.random() * 120
  }

  private pickFor(biome: BiomeId, night: number): WeatherState {
    const preferred = BIOMES[biome].weather
    const roll = Math.random()
    if (night > 0.6 && roll < 0.2) return 'neblina'
    if (preferred === 'neve') return roll < 0.55 ? 'neve' : roll < 0.8 ? 'nublado' : 'limpo'
    if (preferred === 'areia') return roll < 0.35 ? 'areia' : roll < 0.7 ? 'limpo' : 'nublado'
    if (preferred === 'neblina') return roll < 0.5 ? 'neblina' : roll < 0.75 ? 'nublado' : 'chuva'
    if (preferred === 'cinzas') return roll < 0.45 ? 'cinzas' : roll < 0.7 ? 'neblina' : 'tempestade'
    if (preferred === 'chuva') return roll < 0.35 ? 'chuva' : roll < 0.55 ? 'nublado' : roll < 0.68 ? 'tempestade' : 'limpo'
    return roll < 0.55 ? 'limpo' : roll < 0.8 ? 'nublado' : 'chuva'
  }

  private applyState(): void {
    const info = STATE_INFO[this.state]
    this.material.size = info.size
    this.material.color.set(info.color)
    this.rainMaterial.color.set(info.color)
    this.rainMaterial.opacity = info.opacity
    this.tint.set(info.tint)
    this.fogAmount = info.fog
    this.material.opacity = info.opacity
    // Re-seed velocities for the new particle behaviour.
    const speed = info.speed
    for (let i = 0; i < PARTICLES; i += 1) {
      if (this.state === 'neve' || this.state === 'cinzas') {
        this.velocities[i * 3] = (Math.random() - 0.5) * 2.2
        this.velocities[i * 3 + 1] = -speed * (0.6 + Math.random() * 0.8)
        this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 2.2
      } else if (this.state === 'areia') {
        this.velocities[i * 3] = speed * (0.6 + Math.random() * 0.7)
        this.velocities[i * 3 + 1] = -1 - Math.random() * 2
        this.velocities[i * 3 + 2] = speed * 0.2 * (Math.random() - 0.5)
      } else {
        this.velocities[i * 3] = 2.5 + Math.random() * 2
        this.velocities[i * 3 + 1] = -speed * (0.8 + Math.random() * 0.5)
        this.velocities[i * 3 + 2] = 1 + Math.random() * 1.5
      }
    }
    this.onStateChange?.(this.state)
  }

  update(dt: number, camera: THREE.PerspectiveCamera, biome: BiomeId, night: number): void {
    this.time += dt
    this.changeIn -= dt
    if (this.changeIn <= 0) {
      this.target = this.pickFor(biome, night)
      this.changeIn = 110 + Math.random() * 150
      this.applyState()
    }
    if (this.state !== this.target) {
      this.state = this.target
      this.applyState()
    }
    this.blend = Math.min(1, this.blend + dt * 0.35)
    this.flash = Math.max(0, this.flash - dt * 3.2)

    // Lightning during storms.
    if (this.state === 'tempestade') {
      this.lightningIn -= dt
      if (this.lightningIn <= 0) {
        this.lightningIn = 4 + Math.random() * 8
        this.flash = 0.8 + Math.random() * 0.2
        this.onThunder?.()
      }
    }

    const active = this.material.opacity > 0.01
    const isRain = this.state === 'chuva' || this.state === 'tempestade'
    this.points.visible = active && !isRain
    this.rainStreaks.visible = active && isRain
    if (!active) return
    this.points.position.set(camera.position.x, camera.position.y, camera.position.z)
    this.rainStreaks.position.copy(camera.position)
    const wind = this.state === 'areia' ? 18 : 4
    for (let i = 0; i < PARTICLES; i += 1) {
      const idx = i * 3
      this.positions[idx] += (this.velocities[idx] + wind * 0.25) * dt
      this.positions[idx + 1] += this.velocities[idx + 1] * dt
      this.positions[idx + 2] += this.velocities[idx + 2] * dt
      if (this.positions[idx + 1] < -HEIGHT / 2) {
        this.positions[idx] = (Math.random() - 0.5) * AREA
        this.positions[idx + 1] = HEIGHT / 2
        this.positions[idx + 2] = (Math.random() - 0.5) * AREA
      }
      if (this.positions[idx] > AREA / 2) this.positions[idx] -= AREA
      if (this.positions[idx + 2] > AREA / 2) this.positions[idx + 2] -= AREA
      if (this.positions[idx + 2] < -AREA / 2) this.positions[idx + 2] += AREA
      if (isRain) {
        const line = i * 6
        const streak = this.state === 'tempestade' ? 0.028 : 0.022
        this.streakPositions[line] = this.positions[idx]
        this.streakPositions[line + 1] = this.positions[idx + 1]
        this.streakPositions[line + 2] = this.positions[idx + 2]
        this.streakPositions[line + 3] = this.positions[idx] - (this.velocities[idx] + wind * 0.25) * streak
        this.streakPositions[line + 4] = this.positions[idx + 1] - this.velocities[idx + 1] * streak
        this.streakPositions[line + 5] = this.positions[idx + 2] - this.velocities[idx + 2] * streak
      }
    }
    if (isRain) (this.rainStreaks.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    else (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
  }

  get fog(): number {
    return this.fogAmount * this.blend
  }

  get tintColor(): THREE.Color {
    return this.tint
  }

  /** Rain/snow cool the world slightly, used for the wet status. */
  get wetness(): number {
    return this.state === 'chuva' ? 0.6 : this.state === 'tempestade' ? 1 : this.state === 'neve' ? 0.3 : 0
  }

  /** Visibility multiplier for long-range silhouettes. */
  get visibility(): number {
    return clamp(1 - smoothstep(0.001, 0.012, this.fogAmount), 0.25, 1)
  }
}
