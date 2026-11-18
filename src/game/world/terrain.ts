import * as THREE from 'three'
import type { BiomeId } from '../data/types'
import { clamp, smoothstep } from '../core/math'
import { fbm2, ridged2, valueNoise2 } from '../core/rng'
import { BIOMES, type BiomeDef } from './biomes'

export const SEA_LEVEL = 0
/** Half-size of the playable continent; ocean continues a little beyond. */
export const WORLD_RADIUS = 2050
export const CRATER_RADIUS = 300

export type TerrainSample = {
  height: number
  biome: BiomeId
  /** 0 = flat, 1 = vertical cliff. */
  slope: number
  water: boolean
}

/**
 * Seeded height field. Everything derives from `seed`, so two players with different seeds get
 * different continents, while a save always rebuilds the same one.
 */
export class Terrain {
  constructor(readonly seed: number) {}

  /** Raw elevation in metres (sea level is 0). */
  heightAt(x: number, z: number): number {
    const s = this.seed
    const distance = Math.hypot(x, z)
    // Continent mask: 1 inland, 0 deep ocean, with a noisy coastline.
    const coastNoise = fbm2(x * 0.0012 + 11.3, z * 0.0012 - 4.7, s + 5, 3)
    const land = smoothstep(1.06, 0.62, distance / WORLD_RADIUS + (coastNoise - 0.5) * 0.22)

    const rolling = fbm2(x * 0.0017, z * 0.0017, s + 11, 5)
    const hills = fbm2(x * 0.0062, z * 0.0062, s + 23, 4)
    const ridge = ridged2(x * 0.0031, z * 0.0031, s + 37, 4)
    const mountainMask = smoothstep(0.5, 0.8, fbm2(x * 0.001, z * 0.001, s + 51, 3))

    let height = -22 + land * (10 + rolling * 30 + hills * 12 + ridge * ridge * mountainMask * 135)

    // The Eclipse crater at the centre of the continent.
    const crater = Math.exp(-(((distance - 255) / 78) ** 2)) * 105
    const bowl = -smoothstep(300, 40, distance) * 62
    height += (crater + bowl) * smoothstep(0.35, 0.75, land)

    // Volcano cone in the south-east.
    const vx = x - 1080
    const vz = z - 980
    const vd = Math.hypot(vx, vz)
    if (vd < 520) {
      const cone = Math.exp(-((vd / 300) ** 2)) * 150
      height += cone
      const vent = Math.exp(-((vd / 46) ** 2)) * -70
      height += vent
    }

    // Small islands scattered in the ocean ring.
    const islandNoise = fbm2(x * 0.004 + 3.1, z * 0.004 - 8.4, s + 91, 3)
    if (land < 0.55) {
      const island = smoothstep(0.62, 0.78, islandNoise) * smoothstep(0.75, 0.35, land)
      height += island * 38
    }

    // Fine detail so walking never feels like sliding on a triangle.
    height += (valueNoise2(x * 0.09, z * 0.09, s + 133) - 0.5) * 0.55
    return height
  }

  slopeAt(x: number, z: number): number {
    const d = 1.4
    const hx = this.heightAt(x + d, z) - this.heightAt(x - d, z)
    const hz = this.heightAt(x, z + d) - this.heightAt(x, z - d)
    return clamp(Math.hypot(hx, hz) / (2 * d), 0, 3)
  }

  normalAt(x: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
    const d = 1.2
    const hx = this.heightAt(x + d, z) - this.heightAt(x - d, z)
    const hz = this.heightAt(x, z + d) - this.heightAt(x, z - d)
    return out.set(-hx / (2 * d), 1, -hz / (2 * d)).normalize()
  }

  /** Temperature and moisture fields drive the biome map. */
  climateAt(x: number, z: number, height = this.heightAt(x, z)): { temperature: number; moisture: number } {
    const s = this.seed
    const latitude = z / WORLD_RADIUS // -1 north (cold) .. 1 south (warm)
    const temperature = clamp(0.52 + fbm2(x * 0.00085, z * 0.00085, s + 71, 3) * 0.5 - latitude * 0.22 - Math.max(0, height) * 0.0016, 0, 1)
    const moisture = clamp(fbm2(x * 0.0011 + 7.7, z * 0.0011 - 2.3, s + 83, 4) * 1.15 - 0.08, 0, 1)
    return { temperature, moisture }
  }

  /** Biome from pre-sampled height and slope (used by chunk builders to avoid re-evaluating noise). */
  biomeFrom(x: number, z: number, height: number, slope: number): BiomeId {
    const distance = Math.hypot(x, z)
    if (height < -1.2) return 'oceano'
    if (distance < CRATER_RADIUS * 0.92) return 'cinzas'
    if (height < 2.6) return 'praia'
    const { temperature, moisture } = this.climateAt(x, z, height)
    if (height > 118 + temperature * 40) return 'montanha'
    if (temperature < 0.34 && height > 26) return 'neve'
    if (height > 150) return 'montanha'
    if (Math.hypot(x - 1080, z - 980) < 330 && height > 12) return 'vulcanico'
    if (moisture > 0.66 && height < 14) return 'pantano'
    if (temperature > 0.63 && moisture < 0.42) return 'deserto'
    if (distance > WORLD_RADIUS * 0.74) return 'ilha'
    if (slope > 0.85) return 'montanha'
    if (moisture > 0.56) return 'floresta-densa'
    if (moisture > 0.44) return 'floresta'
    return 'planicie'
  }

  biomeAt(x: number, z: number, height = this.heightAt(x, z)): BiomeId {
    return this.biomeFrom(x, z, height, this.slopeAt(x, z))
  }

  biomeDef(x: number, z: number): BiomeDef {
    return BIOMES[this.biomeAt(x, z)]
  }

  sample(x: number, z: number): TerrainSample {
    const height = this.heightAt(x, z)
    return { height, biome: this.biomeAt(x, z, height), slope: this.slopeAt(x, z), water: height < SEA_LEVEL }
  }

  /** Blended ground colour for a vertex, mixing biome grass/rock by slope and height. */
  vertexColor(x: number, z: number, height: number, slope: number, biomeId: BiomeId, out = new THREE.Color()): THREE.Color {
    const biome = BIOMES[biomeId]
    const grass = new THREE.Color(biome.grass)
    const rock = new THREE.Color(biome.rock)
    const accent = new THREE.Color(biome.accent)
    const rocky = smoothstep(0.55, 1.25, slope)
    out.copy(grass).lerp(rock, rocky)
    // Snow caps and sand shading.
    if (height > 130) out.lerp(new THREE.Color('#eef4fb'), smoothstep(130, 185, height) * 0.85)
    if (height < 4) out.lerp(accent, smoothstep(4, 0.4, height) * 0.35)
    // Subtle per-vertex variation keeps large fields from looking flat.
    const variation = valueNoise2(x * 0.12, z * 0.12, this.seed + 201) - 0.5
    out.offsetHSL(variation * 0.02, variation * 0.05, variation * 0.05)
    return out
  }
}
