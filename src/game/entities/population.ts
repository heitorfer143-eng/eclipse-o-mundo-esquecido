import * as THREE from 'three'
import type { NpcDef } from '../data/types'
import { NPCS } from '../data/npcData'
import type { Poi, PoiManager } from '../world/poi'
import type { Spots } from '../world/structures'
import type { World } from '../world/world'
import { Npc } from './npc'
import type { Spawner } from './spawner'
import { pickEnemyFor } from './spawner'
import { rollChest, type LootDrop } from '../systems/loot'

export type Chest = {
  id: string
  position: THREE.Vector3
  tier: number
  opened: boolean
  group: THREE.Group
  lid: THREE.Mesh
  light?: THREE.PointLight
}

export type ResourceKind = 'ferro' | 'prata' | 'mithril' | 'erva' | 'madeira' | 'pesca' | 'cristal'

export type ResourceNode = {
  id: string
  kind: ResourceKind
  position: THREE.Vector3
  group: THREE.Group
  cooldown: number
  depleted: boolean
}

export type Station = { id: string; kind: 'forja' | 'alquimia' | 'fogueira' | 'bancada'; position: THREE.Vector3 }

export type Portal = { id: string; poiId: string; position: THREE.Vector3; name: string }

export type Interactable =
  | { kind: 'npc'; npc: Npc; label: string }
  | { kind: 'chest'; chest: Chest; label: string }
  | { kind: 'resource'; node: ResourceNode; label: string }
  | { kind: 'station'; station: Station; label: string }
  | { kind: 'portal'; portal: Portal; label: string }

const RESOURCE_INFO: Record<ResourceKind, { itemId: string; label: string; color: string }> = {
  ferro: { itemId: 'mat-ferro', label: 'Veio de ferro', color: '#b8b0a4' },
  prata: { itemId: 'mat-prata', label: 'Veio de prata', color: '#d8e0ea' },
  mithril: { itemId: 'mat-mithril', label: 'Veio de mithril', color: '#9fe8ff' },
  erva: { itemId: 'mat-erva', label: 'Erva curativa', color: '#7fd18a' },
  madeira: { itemId: 'mat-madeira', label: 'Tronco de freixo', color: '#8a6a45' },
  pesca: { itemId: 'comida-peixe', label: 'Cardume', color: '#7fd8ff' },
  cristal: { itemId: 'mat-cristal', label: 'Cristal de gelo', color: '#b6e8ff' },
}

/** Spawns and removes townsfolk, chests, harvest nodes and crafting stations with their POI. */
export class Population {
  readonly npcs: Npc[] = []
  readonly chests: Chest[] = []
  readonly nodes: ResourceNode[] = []
  readonly stations: Station[] = []
  readonly portals: Portal[] = []
  private readonly group = new THREE.Group()
  private readonly placedNpcs = new Set<string>()
  private readonly populated = new Set<string>()
  private readonly openedChests = new Set<string>()

  constructor(scene: THREE.Scene, private readonly world: World, private readonly pois: PoiManager, private readonly spawner: Spawner) {
    this.group.name = 'population'
    scene.add(this.group)
  }

  update(dt: number, playerPosition: THREE.Vector3): void {
    for (const poi of this.pois.list()) {
      const spots = this.pois.spotsOf(poi.id)
      if (spots && !this.populated.has(poi.id)) this.populate(poi, spots)
      if (!spots && this.populated.has(poi.id)) this.depopulate(poi.id)
    }
    for (const npc of this.npcs) {
      const near = Math.hypot(npc.position.x - playerPosition.x, npc.position.z - playerPosition.z) < 14
      npc.update(dt, playerPosition, near)
    }
    for (const node of this.nodes) {
      if (!node.depleted) continue
      node.cooldown -= dt
      if (node.cooldown <= 0) {
        node.depleted = false
        node.group.visible = true
      }
    }
    for (const chest of this.chests) {
      if (chest.opened && chest.lid.rotation.x < 1.9) chest.lid.rotation.x += dt * 3
    }
  }

  private populate(poi: Poi, spots: Spots): void {
    this.populated.add(poi.id)
    const home = poi.kind === 'vila' ? 'vila' : poi.kind === 'cidade' ? 'cidade' : poi.kind === 'porto' ? 'porto' : poi.kind === 'acampamento' ? 'acampamento' : poi.kind === 'templo' ? 'templo' : null
    if (home) {
      const candidates = NPCS.filter(def => def.home === home && !this.placedNpcs.has(def.id))
      spots.npcs.forEach((spot, index) => {
        const def = candidates[index] ?? candidates[candidates.length - 1]
        if (!def || this.placedNpcs.has(def.id)) return
        this.placeNpc(def, spot.x, spot.z, spot.y, poi)
      })
    }
    spots.chests.forEach((spot, index) => {
      const id = `${poi.id}-bau-${index}`
      this.chests.push(this.createChest(id, spot.x, spot.z, spot.y, spot.tier))
    })
    spots.resources.forEach((spot, index) => {
      this.nodes.push(this.createResource(`${poi.id}-res-${index}`, spot.kind, spot.x, spot.z, spot.y))
    })
    spots.stations.forEach((spot, index) => {
      this.stations.push({ id: `${poi.id}-est-${index}`, kind: spot.kind, position: new THREE.Vector3(spot.x, spot.y, spot.z) })
    })
    if (spots.portal) this.portals.push({ id: `${poi.id}-portal`, poiId: poi.id, position: new THREE.Vector3(spots.portal.x, spots.portal.y, spots.portal.z), name: poi.name })
    // POI guards: creatures appropriate to the region, tied to the site.
    for (const spot of spots.enemies) {
      const def = pickEnemyFor(this.world.biomeAt(spot.x, spot.z), poi.level, this.world.sky.night,
        poi.id === 'vila-brumal' ? 'lobo-sombrio' : undefined)
      if (!def) continue
      this.spawner.add({ def, level: poi.level, x: spot.x, z: spot.z, homeX: spot.x, homeZ: spot.z })
    }
  }

  private placeNpc(def: NpcDef, x: number, z: number, y: number, poi: Poi): void {
    const npc = new Npc(def, x, z, y, Math.random() * Math.PI * 2)
    npc.root.userData.poiId = poi.id
    this.group.add(npc.root)
    this.npcs.push(npc)
    this.placedNpcs.add(def.id)
  }

  private depopulate(poiId: string): void {
    this.populated.delete(poiId)
    for (let i = this.npcs.length - 1; i >= 0; i -= 1) {
      const npc = this.npcs[i]
      if (npc.root.userData.poiId !== poiId) continue
      this.placedNpcs.delete(npc.def.id)
      npc.dispose()
      this.npcs.splice(i, 1)
    }
    for (let i = this.chests.length - 1; i >= 0; i -= 1) {
      const chest = this.chests[i]
      if (!chest.id.startsWith(poiId)) continue
      chest.group.removeFromParent()
      this.chests.splice(i, 1)
    }
    for (let i = this.nodes.length - 1; i >= 0; i -= 1) {
      const node = this.nodes[i]
      if (!node.id.startsWith(poiId)) continue
      node.group.removeFromParent()
      this.nodes.splice(i, 1)
    }
    for (let i = this.stations.length - 1; i >= 0; i -= 1) {
      if (!this.stations[i].id.startsWith(poiId)) continue
      this.stations.splice(i, 1)
    }
    for (let i = this.portals.length - 1; i >= 0; i -= 1) {
      if (this.portals[i].poiId !== poiId) continue
      this.portals.splice(i, 1)
    }
  }

  private createChest(id: string, x: number, z: number, y: number, tier: number): Chest {
    const group = new THREE.Group()
    const wood = new THREE.MeshStandardMaterial({ color: '#6a4a2c', roughness: 0.9, flatShading: true })
    const metal = new THREE.MeshStandardMaterial({ color: '#c8a45c', roughness: 0.35, metalness: 0.8 })
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.62), wood)
    base.position.y = 0.3
    base.castShadow = true
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.22, 0.66), wood)
    lid.position.set(0, 0.66, -0.3)
    lid.geometry.translate(0, 0, 0.3)
    lid.castShadow = true
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.06, 0.68), metal)
    band.position.y = 0.55
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.06), metal)
    lock.position.set(0, 0.5, 0.32)
    group.add(base, lid, band, lock)
    group.position.set(x, y, z)
    group.rotation.y = Math.random() * Math.PI
    const opened = this.openedChests.has(id)
    let light: THREE.PointLight | undefined
    if (!opened) {
      light = new THREE.PointLight('#ffd08a', 2.2, 5, 2)
      light.position.y = 0.9
      group.add(light)
      lid.rotation.x = 0
    } else {
      lid.rotation.x = 1.9
    }
    this.group.add(group)
    return { id, position: new THREE.Vector3(x, y, z), tier, opened, group, lid, light }
  }

  private createResource(id: string, kind: ResourceKind, x: number, z: number, y: number): ResourceNode {
    const group = new THREE.Group()
    const info = RESOURCE_INFO[kind]
    const material = new THREE.MeshStandardMaterial({ color: info.color, roughness: 0.7, flatShading: true, emissive: new THREE.Color(info.color), emissiveIntensity: kind === 'mithril' || kind === 'cristal' ? 0.8 : 0.1 })
    if (kind === 'erva') {
      for (let i = 0; i < 4; i += 1) {
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.6 + Math.random() * 0.3, 4), material)
        blade.position.set((Math.random() - 0.5) * 0.4, 0.3, (Math.random() - 0.5) * 0.4)
        blade.rotation.z = (Math.random() - 0.5) * 0.4
        blade.castShadow = true
        group.add(blade)
      }
    } else if (kind === 'madeira') {
      const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.5, 7), material)
      stump.position.y = 0.25
      stump.castShadow = true
      group.add(stump)
      for (let i = 0; i < 3; i += 1) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 6), material)
        log.position.set((Math.random() - 0.5) * 0.6, 0.12, (Math.random() - 0.5) * 0.6)
        log.rotation.z = Math.PI / 2
        log.rotation.y = Math.random() * Math.PI
        group.add(log)
      }
    } else if (kind === 'pesca') {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.9, 20), new THREE.MeshBasicMaterial({ color: info.color, transparent: true, opacity: 0.45, side: THREE.DoubleSide }))
      ring.rotation.x = -Math.PI / 2
      ring.position.y = 0.05
      group.add(ring)
    } else if (kind === 'cristal') {
      for (let i = 0; i < 3; i += 1) {
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.22 + Math.random() * 0.15, 0), material)
        crystal.position.set((Math.random() - 0.5) * 0.5, 0.3 + Math.random() * 0.3, (Math.random() - 0.5) * 0.5)
        crystal.rotation.set(Math.random(), Math.random(), Math.random())
        crystal.castShadow = true
        group.add(crystal)
      }
    } else {
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), new THREE.MeshStandardMaterial({ color: '#6f6a63', roughness: 1, flatShading: true }))
      rock.position.y = 0.35
      rock.castShadow = true
      group.add(rock)
      for (let i = 0; i < 4; i += 1) {
        const vein = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), material)
        vein.position.set((Math.random() - 0.5) * 0.7, 0.3 + Math.random() * 0.4, (Math.random() - 0.5) * 0.7)
        group.add(vein)
      }
    }
    group.position.set(x, y, z)
    this.group.add(group)
    return { id, kind, position: new THREE.Vector3(x, y, z), group, cooldown: 0, depleted: false }
  }

  nearest(position: THREE.Vector3, maxDistance = 3.2): Interactable | null {
    let best: Interactable | null = null
    let bestDistance = maxDistance
    for (const npc of this.npcs) {
      const distance = npc.position.distanceTo(position)
      if (distance < bestDistance) {
        bestDistance = distance
        best = { kind: 'npc', npc, label: `Falar com ${npc.def.name}` }
      }
    }
    for (const chest of this.chests) {
      if (chest.opened) continue
      const distance = chest.position.distanceTo(position)
      if (distance < bestDistance + 0.6) {
        bestDistance = distance
        best = { kind: 'chest', chest, label: chest.tier >= 4 ? 'Abrir baú antigo' : 'Abrir baú' }
      }
    }
    for (const node of this.nodes) {
      if (node.depleted) continue
      const distance = node.position.distanceTo(position)
      if (distance < bestDistance + 0.4) {
        bestDistance = distance
        best = { kind: 'resource', node, label: `Coletar ${RESOURCE_INFO[node.kind].label}` }
      }
    }
    for (const station of this.stations) {
      const distance = station.position.distanceTo(position)
      if (distance < bestDistance) {
        bestDistance = distance
        const label = station.kind === 'forja' ? 'Usar a forja' : station.kind === 'alquimia' ? 'Usar a bancada de alquimia' : station.kind === 'fogueira' ? 'Cozinhar na fogueira' : 'Usar a bancada'
        best = { kind: 'station', station, label }
      }
    }
    for (const portal of this.portals) {
      const distance = portal.position.distanceTo(position)
      if (distance < bestDistance + 1.2) {
        bestDistance = distance
        best = { kind: 'portal', portal, label: `Santuário de ${portal.name}` }
      }
    }
    return best
  }

  openChest(chest: Chest, lootBonus = 0): { gold: number; items: LootDrop[] } {
    if (chest.opened) return { gold: 0, items: [] }
    chest.opened = true
    this.openedChests.add(chest.id)
    if (chest.light) {
      chest.group.remove(chest.light)
      chest.light = undefined
    }
    return rollChest(chest.tier, chest.tier * 8, lootBonus)
  }

  gather(node: ResourceNode): { itemId: string; count: number } | null {
    if (node.depleted) return null
    node.depleted = true
    node.cooldown = 45 + Math.random() * 30
    node.group.visible = false
    const info = RESOURCE_INFO[node.kind]
    return { itemId: info.itemId, count: node.kind === 'pesca' ? 1 : 1 + (Math.random() < 0.35 ? 1 : 0) }
  }

  portalById(poiId: string): Portal | undefined {
    return this.portals.find(portal => portal.poiId === poiId)
  }

  get discoveredPortals(): Portal[] {
    return this.portals
  }
}
