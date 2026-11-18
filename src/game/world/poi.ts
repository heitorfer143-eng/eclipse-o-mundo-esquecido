import * as THREE from 'three'
import type { BiomeId } from '../data/types'
import { hash2, mulberry32 } from '../core/rng'
import type { Collider } from './collision'
import {
  buildCamp,
  buildCastle,
  buildCave,
  buildCity,
  buildDungeon,
  buildIslandSite,
  buildPort,
  buildRuins,
  buildShrine,
  buildTemple,
  buildTower,
  buildVillage,
  type SiteResult,
  type Spots,
} from './structures'
import { SEA_LEVEL, type Terrain } from './terrain'

export type PoiKind = 'vila' | 'cidade' | 'castelo' | 'masmorra' | 'templo' | 'ruinas' | 'acampamento' | 'santuario' | 'torre' | 'porto' | 'caverna' | 'ilha'

export type Poi = {
  id: string
  kind: PoiKind
  name: string
  x: number
  z: number
  y: number
  radius: number
  seed: number
  level: number
  bossId?: string
  discovered: boolean
}

type FixedPoi = {
  id: string
  kind: PoiKind
  name: string
  anchor: [number, number]
  biomes: BiomeId[]
  level: number
  radius: number
  bossId?: string
}

export const SPAWN_POINT = { x: 6, z: 806 }

const FIXED_POIS: FixedPoi[] = [
  { id: 'vila-brumal', kind: 'vila', name: 'Brumal', anchor: [-10, 760], biomes: ['planicie', 'floresta'], level: 2, radius: 34 },
  { id: 'cidade-aster', kind: 'cidade', name: 'Aster, a Cidade Eterna', anchor: [170, 690], biomes: ['planicie', 'floresta'], level: 5, radius: 62 },
  { id: 'clareira-corrompida', kind: 'ruinas', name: 'Clareira Corrompida', anchor: [-210, 880], biomes: ['floresta', 'floresta-densa'], level: 8, radius: 40, bossId: 'guardiao-floresta-corrompido' },
  { id: 'pantano-grakk', kind: 'acampamento', name: 'Acampamento de Grakk', anchor: [-420, 380], biomes: ['pantano'], level: 12, radius: 38, bossId: 'senhor-da-guerra-goblin' },
  { id: 'masmorra-ossos', kind: 'masmorra', name: 'Cripta dos Ossos', anchor: [-260, 1180], biomes: ['floresta-densa', 'floresta'], level: 16, radius: 34, bossId: 'rei-dos-ossos' },
  { id: 'ruinas-kharun', kind: 'ruinas', name: 'Ruínas de Kharun', anchor: [1040, -220], biomes: ['deserto'], level: 20, radius: 42, bossId: 'verme-das-areias' },
  { id: 'geleira-skadi', kind: 'templo', name: 'Santuário de Skadi', anchor: [-120, -760], biomes: ['neve', 'montanha'], level: 24, radius: 38, bossId: 'gigante-do-gelo' },
  { id: 'castelo-abandonado', kind: 'castelo', name: 'Castelo de Vharn', anchor: [-700, 60], biomes: ['planicie', 'montanha'], level: 28, radius: 52, bossId: 'comandante-cavaleiro-corrompido' },
  { id: 'vulcao-ignar', kind: 'caverna', name: 'Fornalha de Ignar', anchor: [1080, 980], biomes: ['vulcanico', 'montanha'], level: 32, radius: 46, bossId: 'draco-vulcanico' },
  { id: 'templo-esquecido', kind: 'templo', name: 'Templo Esquecido', anchor: [700, 420], biomes: ['floresta-densa', 'floresta'], level: 36, radius: 40, bossId: 'sacerdote-sombrio-do-eclipse' },
  { id: 'cratera-eclipse', kind: 'ruinas', name: 'Coração da Cicatriz', anchor: [0, 0], biomes: ['cinzas'], level: 40, radius: 70, bossId: 'colosso-da-cratera' },
  { id: 'ilha-secreta', kind: 'ilha', name: 'Ilha de Nyth', anchor: [-1520, 1180], biomes: ['ilha', 'praia'], level: 45, radius: 40, bossId: 'soberano-da-sombra' },
  { id: 'porto-gaivota', kind: 'porto', name: 'Porto Gaivota', anchor: [520, 1220], biomes: ['praia', 'planicie'], level: 6, radius: 34 },
]

const CELL = 460
const NAME_A = ['Bruma', 'Pedra', 'Vale', 'Cinza', 'Ferro', 'Lago', 'Mata', 'Alto', 'Vento', 'Rocha', 'Sol', 'Névoa']
const NAME_B = [' Alta', ' do Norte', ' Quebrado', ' Silente', ' do Corvo', ' Antigo', ' Esquecido', ' do Eclipse', ' Fértil', ' Sombrio']

function siteName(rng: () => number, kind: PoiKind): string {
  const base = NAME_A[Math.floor(rng() * NAME_A.length)]
  const suffix = NAME_B[Math.floor(rng() * NAME_B.length)]
  const prefix = kind === 'vila' ? 'Vila ' : kind === 'torre' ? 'Torre ' : kind === 'caverna' ? 'Caverna ' : kind === 'santuario' ? 'Santuário ' : kind === 'acampamento' ? 'Acampamento ' : kind === 'ruinas' ? 'Ruínas ' : ''
  return `${prefix}${base}${suffix}`
}

function buildSite(poi: Poi, terrain: Terrain): SiteResult {
  switch (poi.kind) {
    case 'vila': return buildVillage(terrain, poi.x, poi.z, poi.seed, poi.name)
    case 'cidade': return buildCity(terrain, poi.x, poi.z, poi.seed)
    case 'castelo': return buildCastle(terrain, poi.x, poi.z, poi.seed)
    case 'masmorra': return buildDungeon(terrain, poi.x, poi.z, poi.seed)
    case 'templo': return buildTemple(terrain, poi.x, poi.z, poi.seed)
    case 'ruinas': return buildRuins(terrain, poi.x, poi.z, poi.seed)
    case 'acampamento': return buildCamp(terrain, poi.x, poi.z, poi.seed)
    case 'santuario': return buildShrine(terrain, poi.x, poi.z)
    case 'torre': return buildTower(terrain, poi.x, poi.z, poi.seed)
    case 'porto': return buildPort(terrain, poi.x, poi.z, poi.seed)
    case 'caverna': return buildCave(terrain, poi.x, poi.z, poi.seed)
    case 'ilha': return buildIslandSite(terrain, poi.x, poi.z, poi.seed)
  }
}

/**
 * Deterministic points of interest: fixed story locations plus a seeded grid of villages,
 * camps, ruins and shrines. Structures stream in around the player.
 */
export class PoiManager {
  readonly group = new THREE.Group()
  readonly pois = new Map<string, Poi>()
  private readonly loaded = new Map<string, { group: THREE.Group; colliders: Collider[]; spots: Spots }>()
  private readonly blockedCells = new Set<string>()
  private readonly cellRadius = 3
  private built = 0

  constructor(private readonly terrain: Terrain, private readonly seed: number) {
    this.group.name = 'pois'
    for (const fixed of FIXED_POIS) this.addFixed(fixed)
    this.rebuildBlocked()
  }

  private addFixed(fixed: FixedPoi): void {
    const spot = this.findSpot(fixed.anchor[0], fixed.anchor[1], fixed.biomes, fixed.radius + 20)
    const poi: Poi = {
      id: fixed.id,
      kind: fixed.kind,
      name: fixed.name,
      x: spot.x,
      z: spot.z,
      y: this.terrain.heightAt(spot.x, spot.z),
      radius: fixed.radius,
      seed: hash2(Math.round(spot.x), Math.round(spot.z), this.seed + 7),
      level: fixed.level,
      bossId: fixed.bossId,
      discovered: false,
    }
    this.pois.set(poi.id, poi)
  }

  /** Spiral search for a buildable spot of the requested biome near an anchor. */
  private findSpot(ax: number, az: number, biomes: BiomeId[], maxRadius: number): { x: number; z: number } {
    for (let radius = 0; radius <= maxRadius; radius += 22) {
      const steps = radius === 0 ? 1 : Math.max(6, Math.round(radius / 8))
      for (let i = 0; i < steps; i += 1) {
        const angle = (i / steps) * Math.PI * 2
        const x = ax + Math.cos(angle) * radius
        const z = az + Math.sin(angle) * radius
        const height = this.terrain.heightAt(x, z)
        if (height < SEA_LEVEL + 3) continue
        if (this.terrain.slopeAt(x, z) > 0.55) continue
        const biome = this.terrain.biomeAt(x, z, height)
        if (biomes.includes(biome)) return { x, z }
      }
    }
    return { x: ax, z: az }
  }

  private ensureAround(px: number, pz: number): void {
    const gx = Math.round(px / CELL)
    const gz = Math.round(pz / CELL)
    for (let dz = -this.cellRadius; dz <= this.cellRadius; dz += 1) {
      for (let dx = -this.cellRadius; dx <= this.cellRadius; dx += 1) {
        const cx = gx + dx
        const cz = gz + dz
        const id = `poi-${cx}-${cz}`
        if (this.pois.has(id)) continue
        const rng = mulberry32((hash2(cx, cz, this.seed + 991) * 4294967296) >>> 0)
        if (rng() > 0.62) continue
        const baseX = cx * CELL + (rng() - 0.5) * CELL * 0.5
        const baseZ = cz * CELL + (rng() - 0.5) * CELL * 0.5
        const height = this.terrain.heightAt(baseX, baseZ)
        if (height < SEA_LEVEL + 2.5) continue
        const biome = this.terrain.biomeAt(baseX, baseZ, height)
        if (biome === 'oceano' || biome === 'cinzas') continue
        const distance = Math.hypot(baseX, baseZ)
        const level = Math.max(1, Math.round(2 + distance / 70))
        let kind: PoiKind = 'acampamento'
        const roll = rng()
        if (biome === 'praia') kind = roll < 0.5 ? 'porto' : 'santuario'
        else if (biome === 'deserto') kind = roll < 0.45 ? 'ruinas' : roll < 0.75 ? 'caverna' : 'torre'
        else if (biome === 'neve' || biome === 'montanha') kind = roll < 0.4 ? 'torre' : roll < 0.7 ? 'caverna' : 'santuario'
        else if (biome === 'pantano') kind = roll < 0.5 ? 'acampamento' : roll < 0.8 ? 'ruinas' : 'santuario'
        else if (biome === 'floresta' || biome === 'floresta-densa') kind = roll < 0.32 ? 'acampamento' : roll < 0.55 ? 'santuario' : roll < 0.78 ? 'caverna' : 'torre'
        else if (biome === 'ilha') kind = roll < 0.5 ? 'templo' : 'santuario'
        else kind = roll < 0.4 ? 'vila' : roll < 0.6 ? 'acampamento' : roll < 0.8 ? 'torre' : 'santuario'
        const spot = this.findSpot(baseX, baseZ, [biome], 60)
        const poi: Poi = {
          id,
          kind,
          name: siteName(rng, kind),
          x: spot.x,
          z: spot.z,
          y: this.terrain.heightAt(spot.x, spot.z),
          radius: kind === 'vila' ? 30 : kind === 'porto' ? 32 : 26,
          seed: (rng() * 4294967296) >>> 0,
          level,
          discovered: false,
        }
        this.pois.set(id, poi)
        this.markBlocked(poi)
      }
    }
  }

  private markBlocked(poi: Poi): void {
    const cell = 16
    const reach = Math.ceil((poi.radius + 10) / cell)
    const gx = Math.round(poi.x / cell)
    const gz = Math.round(poi.z / cell)
    for (let dz = -reach; dz <= reach; dz += 1) {
      for (let dx = -reach; dx <= reach; dx += 1) {
        if (dx * dx + dz * dz > reach * reach) continue
        this.blockedCells.add(`${gx + dx},${gz + dz}`)
      }
    }
  }

  private rebuildBlocked(): void {
    this.blockedCells.clear()
    for (const poi of this.pois.values()) this.markBlocked(poi)
  }

  /** True inside a settlement footprint; chunk props avoid these cells. */
  isBlocked(x: number, z: number): boolean {
    return this.blockedCells.has(`${Math.round(x / 16)},${Math.round(z / 16)}`)
  }

  /** Stream structures around the player. Returns the number of sites built this frame. */
  update(px: number, pz: number, budget = 1): number {
    this.ensureAround(px, pz)
    let built = 0
    for (const poi of this.pois.values()) {
      const distance = Math.hypot(poi.x - px, poi.z - pz)
      const entry = this.loaded.get(poi.id)
      if (distance < 430 && !entry) {
        if (built >= budget) continue
        const site = buildSite(poi, this.terrain)
        site.group.position.set(0, 0, 0)
        this.group.add(site.group)
        this.loaded.set(poi.id, { group: site.group, colliders: site.colliders, spots: site.spots })
        built += 1
        this.built += 1
      } else if (distance > 640 && entry) {
        this.group.remove(entry.group)
        entry.group.traverse(obj => {
          const mesh = obj as THREE.Mesh
          if (mesh.isMesh) mesh.geometry.dispose()
        })
        this.loaded.delete(poi.id)
      }
    }
    return built
  }

  /** Colliders of loaded settlements within reach of a position. */
  collidersNear(x: number, z: number, out: Collider[]): Collider[] {
    out.length = 0
    for (const poi of this.pois.values()) {
      if (!this.loaded.has(poi.id)) continue
      if (Math.abs(poi.x - x) > poi.radius + 40 || Math.abs(poi.z - z) > poi.radius + 40) continue
      out.push(...(this.loaded.get(poi.id)?.colliders ?? []))
    }
    return out
  }

  spotsOf(id: string): Spots | undefined {
    return this.loaded.get(id)?.spots
  }

  get loadedCount(): number {
    return this.loaded.size
  }

  get builtCount(): number {
    return this.built
  }

  /** Closest POI of a kind, used for quests and the map. */
  nearest(x: number, z: number, filter?: (poi: Poi) => boolean): Poi | undefined {
    let best: Poi | undefined
    let bestD = Infinity
    for (const poi of this.pois.values()) {
      if (filter && !filter(poi)) continue
      const d = (poi.x - x) ** 2 + (poi.z - z) ** 2
      if (d < bestD) {
        bestD = d
        best = poi
      }
    }
    return best
  }

  byId(id: string): Poi | undefined {
    return this.pois.get(id)
  }

  /** POI containing a position (for the "you are here" HUD label). */
  at(x: number, z: number): Poi | undefined {
    for (const poi of this.pois.values()) {
      if (Math.hypot(poi.x - x, poi.z - z) < poi.radius + 8) return poi
    }
    return undefined
  }

  list(): Poi[] {
    return [...this.pois.values()]
  }
}
