import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { Terrain } from '../src/game/world/terrain'
import { BIOME_LIST } from '../src/game/world/biomes'
import { colliderContains, resolveCircle, supportHeight, type BoxCollider } from '../src/game/world/collision'
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
import { PoiManager, SPAWN_POINT } from '../src/game/world/poi'

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
    if (mesh.isMesh && mesh.userData.sharedHouseAsset !== true) mesh.geometry.dispose()
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
      for (const list of [site.spots.npcs, site.spots.chests, site.spots.enemies, site.spots.houses, site.spots.resources, site.spots.stations]) {
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
    expect(first.spots.houses.length).toBeGreaterThan(0)
    expect(first.spots.houses[0].id).toBe('house-1')
    expect([first.spots.houses[0].x, first.spots.houses[0].y, first.spots.houses[0].z].every(Number.isFinite)).toBe(true)
    const npcOnlyVolumes = first.colliders.filter(collider => collider.kind === 'box' && collider.npcBlocking)
    expect(npcOnlyVolumes.length).toBeGreaterThan(0)
    for (const npc of first.spots.npcs) {
      const overlap = npcOnlyVolumes.find(collider => colliderContains(collider, npc.x, npc.z))
      expect(overlap, `NPC em (${npc.x}, ${npc.z}) dentro de ${JSON.stringify(overlap)}`).toBeUndefined()
    }
    const doorKeepOut = npcOnlyVolumes.find((collider): collider is BoxCollider => collider.kind === 'box')!
    const insideDoor = { x: (doorKeepOut.minX + doorKeepOut.maxX) / 2, z: (doorKeepOut.minZ + doorKeepOut.maxZ) / 2 }
    const feet = doorKeepOut.bottom + 0.1
    const head = doorKeepOut.top - 0.1
    expect(resolveCircle(insideDoor.x, insideDoor.z, 0.34, doorKeepOut, feet, head)).toBeNull()
    expect(resolveCircle(insideDoor.x, insideDoor.z, 0.34, doorKeepOut, feet, head, true)).not.toBeNull()
    expect(first.spots.enemies).toHaveLength(3)
    expect(first.spots.chests[0]).toMatchObject({ x: X + 9, z: Z + 13, tier: 1 })

    const city = buildCity(terrain, X, Z, SEED)
    const castle = buildCastle(terrain, X, Z, SEED)
    const dungeon = buildDungeon(terrain, X, Z, SEED)
    expect(city.group.name).toBe('Aster')
    expect(city.spots.enemies).toHaveLength(4)
    expect(city.spots.portal).toBeDefined()
    const cityNpcOnlyVolumes = city.colliders.filter(collider => collider.kind === 'box' && collider.npcBlocking)
    for (const npc of city.spots.npcs) {
      expect(cityNpcOnlyVolumes.some(collider => colliderContains(collider, npc.x, npc.z))).toBe(false)
    }
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

  it('usa modelos GLB compartilhados em vila, cidade e porto sem mover spots funcionais', () => {
    const terrain = new Terrain(SEED)
    const template = new THREE.Group()
    const sharedGeometry = new THREE.BoxGeometry(4, 5, 3)
    template.add(new THREE.Mesh(sharedGeometry, new THREE.MeshStandardMaterial()))
    const templates = [template]
    const proceduralVillage = buildVillage(terrain, X, Z, SEED, 'Brumal')
    const village = buildVillage(terrain, X, Z, SEED, 'Brumal', templates)
    const proceduralCity = buildCity(terrain, X, Z, SEED)
    const city = buildCity(terrain, X, Z, SEED, templates)
    const proceduralPort = buildPort(terrain, X, Z, SEED)
    const port = buildPort(terrain, X, Z, SEED, templates)
    const modelInstances = (site: SiteResult): THREE.Object3D[] => {
      const instances: THREE.Object3D[] = []
      site.group.traverse(object => { if (object.name.startsWith('house-model-')) instances.push(object) })
      return instances
    }
    const villageModels = modelInstances(village)
    const cityModels = modelInstances(city)
    const portModels = modelInstances(port)

    expect(villageModels.length).toBeGreaterThanOrEqual(7)
    expect(cityModels).toHaveLength(4)
    expect(portModels).toHaveLength(1)
    expect(villageModels.some(model => model.name === 'house-model-cottage')).toBe(true)
    expect(villageModels.filter(model => model.name === 'house-model-blacksmith')).toHaveLength(1)
    expect(cityModels.filter(model => model.name === 'house-model-tavern')).toHaveLength(1)
    expect(cityModels.filter(model => model.name === 'house-model-blacksmith')).toHaveLength(1)
    expect(cityModels.filter(model => model.name === 'house-model-cottage')).toHaveLength(2)
    expect(village.spots).toEqual(proceduralVillage.spots)
    expect(city.spots).toEqual(proceduralCity.spots)
    expect(port.spots).toEqual(proceduralPort.spots)
    expect(village.colliders.length).toBeGreaterThanOrEqual(villageModels.length * 5)
    const clonedMeshes: THREE.Mesh[] = []
    village.group.traverse(object => {
      const mesh = object as THREE.Mesh
      if (mesh.isMesh && mesh.userData.sharedHouseAsset === true) clonedMeshes.push(mesh)
    })
    expect(clonedMeshes.length).toBeGreaterThanOrEqual(7)
    expect(clonedMeshes.every(mesh => mesh.geometry === sharedGeometry)).toBe(true)
    expect([...villageModels, ...cityModels, ...portModels].every(model => model.scale.toArray().every(Number.isFinite))).toBe(true)

    for (const site of [proceduralVillage, village, proceduralCity, city, proceduralPort, port]) disposeSite(site)
    sharedGeometry.dispose()
  })

  it('realoca a oficina para a área plana próxima e mantém a forja e o NPC junto da casa', () => {
    const terrain = {
      heightAt: (x: number, z: number) => x * 0.05 + z * 0.02,
      biomeAt: () => 'pradera',
      slopeAt: (x: number, z: number) => x >= X + 18 && x <= X + 22 && z >= Z - 14 && z <= Z - 10 ? 10 : 0,
    } as unknown as Terrain
    const template = new THREE.Group()
    template.add(new THREE.Mesh(new THREE.BoxGeometry(4, 5, 3), new THREE.MeshStandardMaterial()))
    const city = buildCity(terrain, X, Z, SEED, [template, template, template])
    const blacksmith = city.spots.houses[2]
    const forgeStation = city.spots.stations.find(station => station.kind === 'forja')!
    const smithNpc = city.spots.npcs.find(npc => Math.abs(npc.x - (X + 28)) < 0.001
      && Math.abs(npc.z - (Z - 4)) < 0.001)

    expect(blacksmith.x).toBeCloseTo(X + 24, 5)
    expect(forgeStation.x).toBeCloseTo(X + 28, 5)
    expect(forgeStation.y).toBeCloseTo(blacksmith.y, 5)
    expect(smithNpc).toBeDefined()
    expect(smithNpc!.y).toBeCloseTo(terrain.heightAt(smithNpc!.x, smithNpc!.z), 5)
    city.group.traverse(object => {
      const mesh = object as THREE.Mesh
      if (mesh.isMesh && mesh.userData.sharedHouseAsset !== true) mesh.geometry.dispose()
    })
    template.traverse(object => {
      const mesh = object as THREE.Mesh
      if (mesh.isMesh) mesh.geometry.dispose()
    })
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

describe('destino de exploração inicial', () => {
  it('posiciona as Ruínas da Vigília perto de Brumal e gera baús de nível 1 e 2', () => {
    const terrain = new Terrain(SEED)
    const pois = new PoiManager(terrain, SEED)
    const ruins = pois.byId('ruinas-vigilia')!
    expect(Math.hypot(ruins.x - SPAWN_POINT.x, ruins.z - SPAWN_POINT.z)).toBeLessThan(300)
    for (let attempt = 0; attempt < 10 && !pois.spotsOf(ruins.id); attempt += 1) {
      pois.update(ruins.x, ruins.z, 20)
    }
    expect(pois.spotsOf(ruins.id)?.chests.map(chest => chest.tier)).toEqual([1, 2])
  })
})
