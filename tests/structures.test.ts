import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { Terrain } from '../src/game/world/terrain'
import { BIOME_LIST } from '../src/game/world/biomes'
import { supportHeight } from '../src/game/world/collision'
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
  STRUCTURE_MATERIALS,
  type SiteResult,
} from '../src/game/world/structures'

const SEED = 73_102
const X = 18
const Z = 42

type SiteCase = { name: string; build: (terrain: Terrain) => SiteResult }

function cases(): SiteCase[] {
  return [
    { name: 'Brumal', build: t => buildVillage(t, X, Z, SEED, 'Brumal') },
    { name: 'Aster', build: t => buildCity(t, X, Z, SEED) },
    { name: 'Castelo Abandonado', build: t => buildCastle(t, X, Z, SEED) },
    { name: 'Masmorra', build: t => buildDungeon(t, X, Z, SEED) },
    { name: 'Templo Escondido', build: t => buildTemple(t, X, Z, SEED) },
    { name: 'Ruínas Antigas', build: t => buildRuins(t, X, Z, SEED) },
    { name: 'Acampamento', build: t => buildCamp(t, X, Z, SEED) },
    { name: 'Santuário', build: t => buildShrine(t, X, Z) },
    { name: 'Torre em Ruínas', build: t => buildTower(t, X, Z, SEED) },
    { name: 'Porto', build: t => buildPort(t, X, Z, SEED) },
    { name: 'Caverna', build: t => buildCave(t, X, Z, SEED) },
    { name: 'Ilha Secreta', build: t => buildIslandSite(t, X, Z, SEED) },
  ]
}

function disposeSite(site: SiteResult): void {
  site.group.traverse(object => {
    const mesh = object as THREE.Mesh
    if (mesh.isMesh) mesh.geometry.dispose()
  })
}

describe('arquitetura procedural do mundo', () => {
  it('constrói todos os 12 tipos de sítio com geometria finita e spots válidos', () => {
    const terrain = new Terrain(SEED)
    for (const siteCase of cases()) {
      const site = siteCase.build(terrain)
      expect(site.group.name, siteCase.name).toBe(siteCase.name)
      expect(site.group.children.length, siteCase.name).toBeGreaterThan(0)
      const bounds = new THREE.Box3().setFromObject(site.group)
      expect(bounds.isEmpty(), siteCase.name).toBe(false)
      for (const value of [...bounds.min.toArray(), ...bounds.max.toArray()]) expect(Number.isFinite(value), siteCase.name).toBe(true)

      const meshes: THREE.Mesh[] = []
      site.group.traverse(object => {
        const mesh = object as THREE.Mesh
        if (mesh.isMesh) meshes.push(mesh)
      })
      expect(meshes.length, siteCase.name).toBeGreaterThan(0)
      const totalVertices = meshes.reduce((sum, mesh) => sum + mesh.geometry.getAttribute('position').count, 0)
      expect(meshes.length, siteCase.name).toBeLessThanOrEqual(18)
      expect(totalVertices, siteCase.name).toBeLessThan(30_000)
      for (const mesh of meshes) {
        expect(Object.values(STRUCTURE_MATERIALS), siteCase.name).toContain(mesh.material)
        const positions = mesh.geometry.getAttribute('position')
        expect(positions.count, siteCase.name).toBeGreaterThan(0)
        for (let i = 0; i < positions.count; i += 1) {
          expect(Number.isFinite(positions.getX(i)) && Number.isFinite(positions.getY(i)) && Number.isFinite(positions.getZ(i)), siteCase.name).toBe(true)
        }
      }
      for (const list of [site.spots.npcs, site.spots.chests, site.spots.enemies, site.spots.resources, site.spots.stations]) {
        for (const spot of list) expect([spot.x, spot.y, spot.z].every(Number.isFinite), siteCase.name).toBe(true)
      }
      if (site.spots.portal) expect([site.spots.portal.x, site.spots.portal.y, site.spots.portal.z].every(Number.isFinite), siteCase.name).toBe(true)
      disposeSite(site)
    }
  })

  it('mantém materiais válidos e regionais em todos os biomas', () => {
    for (const biome of BIOME_LIST) {
      const regionalTerrain = { heightAt: () => 0, biomeAt: () => biome.id } as unknown as Terrain
      const site = buildVillage(regionalTerrain, 0, 0, SEED, `Vila ${biome.id}`)
      site.group.traverse(object => {
        const mesh = object as THREE.Mesh
        if (mesh.isMesh) expect(Object.values(STRUCTURE_MATERIALS), biome.id).toContain(mesh.material)
      })
      disposeSite(site)
    }
  })

  it('mantém geração determinística e contratos essenciais da vila e dos POIs', () => {
    const terrain = new Terrain(SEED)
    const first = buildVillage(terrain, X, Z, SEED, 'Brumal')
    const repeated = buildVillage(terrain, X, Z, SEED, 'Brumal')
    const firstBounds = new THREE.Box3().setFromObject(first.group)
    const repeatedBounds = new THREE.Box3().setFromObject(repeated.group)

    expect(firstBounds.min.toArray()).toEqual(repeatedBounds.min.toArray())
    expect(firstBounds.max.toArray()).toEqual(repeatedBounds.max.toArray())
    expect(first.spots.npcs[0]).toEqual({ x: X + 4, z: Z + 1, y: terrain.heightAt(X + 4, Z + 1) })
    expect(first.spots.enemies).toHaveLength(3)
    expect(first.spots.chests[0]).toMatchObject({ x: X + 9, z: Z + 13, tier: 1 })

    const city = buildCity(terrain, X, Z, SEED)
    const castle = buildCastle(terrain, X, Z, SEED)
    const dungeon = buildDungeon(terrain, X, Z, SEED)
    expect(city.group.name).toBe('Aster')
    expect(city.spots.enemies).toHaveLength(4)
    expect(city.spots.portal).toBeDefined()
    expect(castle.spots.boss).toBeDefined()
    expect(castle.spots.enemies).toHaveLength(5)
    expect(dungeon.spots.boss).toBeDefined()
    expect(dungeon.spots.enemies).toHaveLength(6)

    disposeSite(first)
    disposeSite(repeated)
    disposeSite(city)
    disposeSite(castle)
    disposeSite(dungeon)
  })

  it('fornece piso suportado para a câmara da masmorra sem alterar o terreno ou o save', () => {
    const terrain = new Terrain(SEED)
    const site = buildDungeon(terrain, X, Z, SEED)
    const ground = terrain.heightAt(X, Z)
    const floor = supportHeight(X, Z, ground, ground, site.colliders)

    expect(floor).toBeGreaterThan(ground)
    expect(floor).toBeCloseTo(ground + 0.23, 5)
    disposeSite(site)
  })
})
