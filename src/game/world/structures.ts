import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { mulberry32 } from '../core/rng'
import type { BoxCollider, Collider } from './collision'
import type { Terrain } from './terrain'

export type MaterialKey = 'pedra' | 'pedra-escura' | 'madeira' | 'telhado' | 'tecido' | 'metal' | 'brilho' | 'folha' | 'agua'

export const STRUCTURE_MATERIALS: Record<MaterialKey, THREE.Material> = {
  pedra: new THREE.MeshStandardMaterial({ color: '#928d7f', roughness: 0.95, flatShading: true }),
  'pedra-escura': new THREE.MeshStandardMaterial({ color: '#57534e', roughness: 0.95, flatShading: true }),
  madeira: new THREE.MeshStandardMaterial({ color: '#6b4a32', roughness: 0.9, flatShading: true }),
  telhado: new THREE.MeshStandardMaterial({ color: '#7d3f35', roughness: 0.85, flatShading: true }),
  tecido: new THREE.MeshStandardMaterial({ color: '#c2a878', roughness: 1, flatShading: true, side: THREE.DoubleSide }),
  metal: new THREE.MeshStandardMaterial({ color: '#767a85', roughness: 0.4, metalness: 0.75, flatShading: true }),
  brilho: new THREE.MeshStandardMaterial({ color: '#ffd08a', emissive: '#ff9c3a', emissiveIntensity: 2.2, roughness: 0.6 }),
  folha: new THREE.MeshStandardMaterial({ color: '#4f8a45', roughness: 1, flatShading: true }),
  agua: new THREE.MeshStandardMaterial({ color: '#3a7f92', roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85 }),
}

export type Spots = {
  npcs: { x: number; z: number; y: number }[]
  chests: { x: number; z: number; y: number; tier: number }[]
  enemies: { x: number; z: number; y: number }[]
  braziers: { x: number; z: number; y: number }[]
  resources: { x: number; z: number; y: number; kind: 'ferro' | 'prata' | 'mithril' | 'erva' | 'madeira' | 'pesca' | 'cristal' }[]
  stations: { x: number; z: number; y: number; kind: 'forja' | 'alquimia' | 'fogueira' | 'bancada' }[]
  boss?: { x: number; z: number; y: number }
  portal?: { x: number; z: number; y: number }
}

/**
 * Accumulates primitive parts per material and merges them into a handful of meshes.
 * Every solid part also registers a world-space collider, so buildings block movement and
 * floors/roofs can be stood on.
 */
export class StructureBuilder {
  private readonly parts = new Map<MaterialKey, THREE.BufferGeometry[]>()
  readonly colliders: Collider[] = []
  readonly spots: Spots = { npcs: [], chests: [], enemies: [], braziers: [], resources: [], stations: [] }
  readonly lights: { x: number; y: number; z: number; color: string; intensity: number; distance: number }[] = []

  constructor(readonly originX: number, readonly originZ: number, readonly baseY: number) {}

  box(x: number, y: number, z: number, w: number, h: number, d: number, material: MaterialKey, rotate = 0, collide = false, solidTop = false): void {
    const geometry = new THREE.BoxGeometry(w, h, d)
    if (rotate) geometry.rotateY(rotate)
    geometry.translate(x, y, z)
    const list = this.parts.get(material) ?? []
    list.push(geometry)
    this.parts.set(material, list)
    if (collide) {
      const extentX = rotate ? Math.abs(w * Math.cos(rotate)) + Math.abs(d * Math.sin(rotate)) : w
      const extentZ = rotate ? Math.abs(w * Math.sin(rotate)) + Math.abs(d * Math.cos(rotate)) : d
      this.addCollider(x - extentX / 2, x + extentX / 2, z - extentZ / 2, z + extentZ / 2, y + h / 2, y - h / 2, true, solidTop)
    }
  }

  cylinder(x: number, y: number, z: number, radius: number, height: number, material: MaterialKey, segments = 8, collide = false): void {
    const geometry = new THREE.CylinderGeometry(radius, radius * 1.05, height, segments)
    geometry.translate(x, y, z)
    const list = this.parts.get(material) ?? []
    list.push(geometry)
    this.parts.set(material, list)
    if (collide) this.colliders.push({ kind: 'circle', x, z, radius, top: y + height / 2 })
  }

  cone(x: number, y: number, z: number, radius: number, height: number, material: MaterialKey, segments = 6): void {
    const geometry = new THREE.ConeGeometry(radius, height, segments)
    geometry.translate(x, y, z)
    const list = this.parts.get(material) ?? []
    list.push(geometry)
    this.parts.set(material, list)
  }

  plane(x: number, y: number, z: number, w: number, d: number, material: MaterialKey, rotate = 0): void {
    const geometry = new THREE.PlaneGeometry(w, d)
    geometry.rotateX(-Math.PI / 2)
    geometry.rotateY(rotate)
    geometry.translate(x, y, z)
    const list = this.parts.get(material) ?? []
    list.push(geometry)
    this.parts.set(material, list)
  }

  addCollider(minX: number, maxX: number, minZ: number, maxZ: number, top: number, bottom: number, blocking = true, solidTop = true): BoxCollider {
    const collider: BoxCollider = { kind: 'box', minX, maxX, minZ, maxZ, top, bottom, blocking, solidTop }
    this.colliders.push(collider)
    return collider
  }

  build(): THREE.Group {
    const group = new THREE.Group()
    for (const [key, geometries] of this.parts) {
      if (!geometries.length) continue
      const merged = mergeGeometries(geometries, false)
      for (const g of geometries) g.dispose()
      if (!merged) continue
      merged.computeVertexNormals()
      const mesh = new THREE.Mesh(merged, STRUCTURE_MATERIALS[key])
      mesh.castShadow = key !== 'agua'
      mesh.receiveShadow = true
      group.add(mesh)
    }
    for (const light of this.lights) {
      const point = new THREE.PointLight(light.color, light.intensity, light.distance, 2)
      point.position.set(light.x, light.y, light.z)
      group.add(point)
    }
    this.parts.clear()
    return group
  }
}

function house(b: StructureBuilder, x: number, z: number, y: number, w: number, d: number, h: number, rng: () => number, roofColor: MaterialKey = 'telhado'): void {
  const wall = 0.35
  const base = y + h / 2
  b.box(x, base, z - d / 2, w, h, wall, 'madeira', 0, true)
  b.box(x, base, z + d / 2, w, h, wall, 'madeira', 0, true)
  b.box(x - w / 2, base, z, wall, h, d, 'madeira', 0, true)
  b.box(x + w / 2, base, z, wall, h, d, 'madeira', 0, true)
  b.box(x, y + h + 0.25, z, w + 0.9, 0.5, d + 0.9, roofColor, 0, true, true)
  b.box(x, y + h + 0.95, z, w * 0.62, 1.4, d * 0.62, roofColor)
  b.box(x, y + 0.08, z, w - 0.4, 0.16, d - 0.4, 'pedra', 0, false, true)
  // Door frame and warm window light.
  b.box(x, y + 1.05, z + d / 2 + 0.02, 1.1, 2.1, 0.12, 'pedra-escura')
  b.box(x + w * 0.3, y + h * 0.62, z + d / 2 + 0.02, 0.7, 0.7, 0.1, 'brilho')
  b.lights.push({ x, y: y + h * 0.6, z: z + d / 2 + 0.6, color: '#ffb15c', intensity: 3.2, distance: 9 })
  if (rng() > 0.55) b.box(x + w * 0.34, y + h + 2.2, z + d * 0.2, 0.7, 1.6, 0.7, 'pedra')
}

function fence(b: StructureBuilder, x1: number, z1: number, x2: number, z2: number, y: number): void {
  const length = Math.hypot(x2 - x1, z2 - z1)
  const count = Math.max(1, Math.round(length / 2.4))
  for (let i = 0; i <= count; i += 1) {
    const t = i / count
    b.box(x1 + (x2 - x1) * t, y + 0.7, z1 + (z2 - z1) * t, 0.18, 1.4, 0.18, 'madeira')
  }
  const angle = Math.atan2(z2 - z1, x2 - x1)
  b.box((x1 + x2) / 2, y + 1.1, (z1 + z2) / 2, length, 0.12, 0.12, 'madeira', -angle)
}

function campfire(b: StructureBuilder, x: number, z: number, y: number): void {
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * Math.PI * 2
    b.box(x + Math.cos(a) * 0.75, y + 0.18, z + Math.sin(a) * 0.75, 0.42, 0.36, 0.42, 'pedra')
  }
  b.box(x, y + 0.35, z, 1.1, 0.25, 0.25, 'madeira', 0.5)
  b.box(x, y + 0.35, z, 1.1, 0.25, 0.25, 'madeira', -0.5)
  b.cone(x, y + 0.95, z, 0.5, 1.2, 'brilho', 6)
  b.lights.push({ x, y: y + 1.3, z, color: '#ff9a4d', intensity: 7, distance: 16 })
  b.spots.stations.push({ x: x + 1.4, z, y, kind: 'fogueira' })
}

function brazier(b: StructureBuilder, x: number, z: number, y: number): void {
  b.cylinder(x, y + 0.55, z, 0.34, 1.1, 'pedra-escura', 8, true)
  b.cylinder(x, y + 1.2, z, 0.5, 0.25, 'metal', 8)
  b.cone(x, y + 1.6, z, 0.36, 0.8, 'brilho', 6)
  b.lights.push({ x, y: y + 1.7, z, color: '#ffb04d', intensity: 5, distance: 13 })
  b.spots.braziers.push({ x, z, y })
}

function well(b: StructureBuilder, x: number, z: number, y: number): void {
  b.cylinder(x, y + 0.5, z, 1.5, 1, 'pedra', 10, true)
  b.cylinder(x, y + 0.95, z, 1.15, 0.2, 'agua', 10)
  b.box(x - 1.4, y + 1.9, z, 0.2, 2.4, 0.2, 'madeira')
  b.box(x + 1.4, y + 1.9, z, 0.2, 2.4, 0.2, 'madeira')
  b.box(x, y + 3.05, z, 3.1, 0.2, 0.25, 'madeira')
  b.box(x, y + 2.2, z, 0.06, 1.5, 0.06, 'madeira')
}

function marketStall(b: StructureBuilder, x: number, z: number, y: number, rng: () => number): void {
  b.box(x, y + 0.9, z, 2.6, 0.15, 1.3, 'madeira', 0, true, true)
  b.box(x - 1.2, y + 0.45, z, 0.16, 0.9, 0.16, 'madeira')
  b.box(x + 1.2, y + 0.45, z, 0.16, 0.9, 0.16, 'madeira')
  b.box(x, y + 2.6, z, 3, 0.12, 2, 'tecido')
  for (let i = 0; i < 4; i += 1) b.box(x - 1.2 + i * 0.8, y + 1.1, z + (rng() - 0.5) * 0.6, 0.3, 0.3, 0.3, rng() > 0.5 ? 'folha' : 'brilho')
  b.lights.push({ x, y: y + 2.1, z, color: '#ffd08a', intensity: 2.4, distance: 8 })
}

function tower(b: StructureBuilder, x: number, z: number, y: number, height: number, radius: number): void {
  b.cylinder(x, y + height / 2, z, radius, height, 'pedra', 10, true)
  b.cylinder(x, y + height + 0.4, z, radius + 0.35, 0.8, 'pedra-escura', 10)
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2
    b.box(x + Math.cos(a) * (radius + 0.1), y + height + 1.2, z + Math.sin(a) * (radius + 0.1), 0.7, 1, 0.7, 'pedra')
  }
  b.box(x, y + height * 0.55, z + radius + 0.05, 0.6, 0.9, 0.1, 'brilho')
}

function arch(b: StructureBuilder, x: number, z: number, y: number, width: number, height: number, rotate = 0): void {
  b.box(x - width / 2, y + height / 2, z, 0.7, height, 0.7, 'pedra', rotate, true)
  b.box(x + width / 2, y + height / 2, z, 0.7, height, 0.7, 'pedra', rotate, true)
  b.box(x, y + height + 0.35, z, width + 1.4, 0.7, 0.9, 'pedra', rotate)
}

function stairs(b: StructureBuilder, x: number, z: number, y: number, width: number, steps: number, depth: number, rise: number): void {
  for (let i = 0; i < steps; i += 1) {
    b.box(x, y + rise * (i + 0.5), z + depth * i, width, rise, depth, 'pedra', 0, false, true)
  }
}

export type SiteResult = { group: THREE.Group; colliders: Collider[]; spots: Spots }

/** A village of timber houses around a well, with a forge, shrine and fields. */
export function buildVillage(terrain: Terrain, x: number, z: number, seed: number, name: string): SiteResult {
  const y = terrain.heightAt(x, z)
  const b = new StructureBuilder(x, z, y)
  const rng = mulberry32(seed)
  well(b, x, z, y)
  // The first village NPC is the story guide; keep her in the open near the well.
  b.spots.npcs.push({ x: x + 4, z: z + 1, y: terrain.heightAt(x + 4, z + 1) })
  const count = 6 + Math.floor(rng() * 4)
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + rng() * 0.4
    const radius = 20 + rng() * 8
    const hx = x + Math.cos(angle) * radius
    const hz = z + Math.sin(angle) * radius
    const hy = terrain.heightAt(hx, hz)
    house(b, hx, hz, hy, 5.5 + rng() * 2.5, 5 + rng() * 2, 3.2 + rng() * 0.9, rng)
    b.spots.npcs.push({ x: hx + 2.6, z: hz + 2.6, y: terrain.heightAt(hx + 2.6, hz + 2.6) })
  }
  // Forge with an anvil and a crafting station.
  const fx = x + 13
  const fz = z - 9
  const fy = terrain.heightAt(fx, fz)
  b.box(fx, fy + 1.6, fz, 6, 3.2, 5, 'madeira', 0, true, true)
  b.box(fx, fy + 3.4, fz, 7, 0.5, 6, 'telhado')
  b.box(fx + 1.6, fy + 1.05, fz + 1.2, 0.9, 0.6, 0.5, 'metal')
  b.box(fx - 1.4, fy + 0.8, fz + 1.4, 1.2, 0.8, 0.9, 'pedra-escura')
  b.lights.push({ x: fx, y: fy + 2.4, z: fz + 2, color: '#ff8a3c', intensity: 5, distance: 12 })
  b.spots.stations.push({ x: fx + 3.4, z: fz + 2.6, y: fy, kind: 'forja' })
  b.spots.npcs.push({ x: fx + 3.4, z: fz + 3.6, y: fy })
  // Alchemy bench under a canopy.
  const ax = x - 14
  const az = z + 10
  const ay = terrain.heightAt(ax, az)
  marketStall(b, ax, az, ay, rng)
  b.spots.stations.push({ x: ax, z: az + 1.8, y: ay, kind: 'alquimia' })
  b.spots.npcs.push({ x: ax + 1.6, z: az + 2.4, y: ay })
  // Shrine: fast travel point.
  const sx = x - 4
  const sz = z + 20
  const sy = terrain.heightAt(sx, sz)
  b.cylinder(sx, sy + 0.25, sz, 3.4, 0.5, 'pedra', 8, false)
  b.box(sx, sy + 1.5, sz - 1.4, 1.4, 2.4, 0.5, 'pedra-escura', 0, true)
  b.cone(sx, sy + 3.4, sz - 1.2, 0.45, 1.1, 'brilho', 6)
  b.lights.push({ x: sx, y: sy + 3.4, z: sz - 1.2, color: '#7fd6ff', intensity: 6, distance: 18 })
  b.spots.portal = { x: sx, z: sz, y: sy }
  // Fields and fences.
  fence(b, x - 26, z - 20, x - 8, z - 20, y)
  fence(b, x - 26, z - 20, x - 26, z - 4, y)
  for (let i = 0; i < 10; i += 1) {
    const cx = x - 24 + (i % 5) * 3.4
    const cz = z - 18 + Math.floor(i / 5) * 3.2
    b.box(cx, terrain.heightAt(cx, cz) + 0.25, cz, 2.4, 0.4, 2.2, 'folha')
  }
  b.spots.chests.push({ x: x + 9, z: z + 13, y: terrain.heightAt(x + 9, z + 13), tier: 1 })
  b.spots.resources.push({ x: x - 20, z: z + 4, y: terrain.heightAt(x - 20, z + 4), kind: 'erva' })
  for (let i = 0; i < 3; i += 1) b.spots.enemies.push({ x: x + 26 + rng() * 10, z: z + 8 + rng() * 14, y: terrain.heightAt(x + 26, z + 8) })
  b.spots.resources.push({ x: x - 24, z: z + 8, y: terrain.heightAt(x - 24, z + 8), kind: 'erva' })
  b.spots.resources.push({ x: x - 16, z: z + 8, y: terrain.heightAt(x - 16, z + 8), kind: 'erva' })
  b.spots.resources.push({ x: x + 18, z: z + 16, y: terrain.heightAt(x + 18, z + 16), kind: 'madeira' })
  b.spots.resources.push({ x: x - 16, z: z - 16, y: terrain.heightAt(x - 16, z - 16), kind: 'ferro' })
  b.spots.npcs.push({ x: sx + 2.5, z: sz + 1, y: sy })
  b.spots.npcs.push({ x: x - 2, z: z + 4, y })
  b.spots.npcs.push({ x: x + 4, z: z - 3, y })
  const group = b.build()
  group.name = name
  return { group, colliders: b.colliders, spots: b.spots }
}

/** The great city of Aster: walls, gate, keep, market square and every shop. */
export function buildCity(terrain: Terrain, x: number, z: number, seed: number): SiteResult {
  const y = terrain.heightAt(x, z)
  const b = new StructureBuilder(x, z, y)
  const rng = mulberry32(seed)
  const size = 52
  // Outer walls with a southern gate.
  const wallH = 9
  for (let i = 0; i < 4; i += 1) {
    const horizontal = i % 2 === 0
    const sign = i < 2 ? -1 : 1
    const wx = horizontal ? x : x + sign * size
    const wz = horizontal ? z + sign * size : z
    const length = size * 2
    const segments = 9
    for (let s = 0; s < segments; s += 1) {
      const t = (s + 0.5) / segments - 0.5
      const sx = horizontal ? wx + t * length : wx
      const sz = horizontal ? wz : wz + t * length
      if (i === 3 && Math.abs(t) < 0.09) continue // gate opening
      b.box(sx, y + wallH / 2, sz, horizontal ? length / segments : 1.6, wallH, horizontal ? 1.6 : length / segments, 'pedra', 0, true, true)
    }
  }
  for (const [tx, tz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    tower(b, x + tx * size, z + tz * size, y, wallH + 5, 4.2)
  }
  arch(b, x, z + size, y, 7, 7)
  // Keep in the north.
  b.box(x, y + 7, z - 30, 26, 14, 16, 'pedra', 0, true, true)
  b.box(x, y + 14.6, z - 30, 28, 1.2, 18, 'pedra-escura', 0, true, true)
  for (let i = 0; i < 4; i += 1) tower(b, x - 12 + i * 8, z - 21, y, 18, 2.6)
  b.box(x, y + 5, z - 22, 3, 10, 0.6, 'madeira')
  // Great hall / tavern.
  house(b, x - 24, z + 6, y, 14, 10, 5.2, rng, 'telhado')
  house(b, x + 26, z + 4, y, 12, 9, 4.8, rng, 'telhado')
  // Market square: stalls around a fountain.
  b.cylinder(x, y + 0.5, z + 6, 6, 0.8, 'pedra', 14, false)
  b.cylinder(x, y + 0.9, z + 6, 5.2, 0.25, 'agua', 14)
  b.cylinder(x, y + 1.6, z + 6, 0.7, 2.4, 'pedra', 8, true)
  b.cylinder(x, y + 2.9, z + 6, 2.1, 0.4, 'pedra', 10)
  b.lights.push({ x, y: y + 3.4, z: z + 6, color: '#9fd8ff', intensity: 6, distance: 20 })
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2
    marketStall(b, x + Math.cos(angle) * 14, z + 6 + Math.sin(angle) * 12, y, rng)
    b.spots.npcs.push({ x: x + Math.cos(angle) * 16, z: z + 6 + Math.sin(angle) * 14, y })
  }
  // Blacksmith, alchemy and temple.
  b.box(x + 20, y + 3, z - 12, 12, 6, 9, 'pedra', 0, true, true)
  b.box(x + 20, y + 6.4, z - 12, 13, 0.8, 10, 'telhado')
  b.box(x + 16, y + 1.4, z - 8, 1.6, 1, 1.2, 'metal')
  b.lights.push({ x: x + 20, y: y + 3.6, z: z - 8, color: '#ff8a3c', intensity: 7, distance: 16 })
  b.spots.stations.push({ x: x + 24, z: z - 6, y, kind: 'forja' })
  b.spots.npcs.push({ x: x + 24, z: z - 4, y })
  b.box(x - 20, y + 2.6, z - 12, 9, 5.2, 8, 'madeira', 0, true, true)
  b.box(x - 20, y + 5.6, z - 12, 10, 0.7, 9, 'telhado')
  b.spots.stations.push({ x: x - 17, z: z - 7, y, kind: 'alquimia' })
  b.spots.npcs.push({ x: x - 15, z: z - 7, y })
  // Temple of the Seven with statues.
  b.cylinder(x + 2, y + 0.4, z - 8, 8, 0.8, 'pedra', 12, false)
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * Math.PI * 2
    const px = x + 2 + Math.cos(angle) * 6
    const pz = z - 8 + Math.sin(angle) * 6
    b.cylinder(px, y + 2.4, pz, 0.5, 4, 'pedra', 8, true)
    b.box(px, y + 5.1, pz, 1.1, 1.8, 1.1, i === 6 ? 'brilho' : 'pedra-escura')
  }
  b.spots.portal = { x: x + 2, z: z - 2, y }
  b.spots.npcs.push({ x: x + 6, z: z - 4, y })
  b.spots.chests.push({ x: x - 8, z: z - 16, y: terrain.heightAt(x - 8, z - 16), tier: 3 })
  b.spots.resources.push({ x: x + 30, z: z + 18, y: terrain.heightAt(x + 30, z + 18), kind: 'madeira' })
  b.spots.resources.push({ x: x - 32, z: z + 22, y: terrain.heightAt(x - 32, z + 22), kind: 'ferro' })
  for (let i = 0; i < 4; i += 1) b.spots.enemies.push({ x: x + 40 + rng() * 20, z: z - 30 - rng() * 20, y: terrain.heightAt(x + 40, z - 30) })
  const group = b.build()
  group.name = 'Aster'
  return { group, colliders: b.colliders, spots: b.spots }
}

export function buildCastle(terrain: Terrain, x: number, z: number, seed: number): SiteResult {
  const y = terrain.heightAt(x, z)
  const b = new StructureBuilder(x, z, y)
  const rng = mulberry32(seed)
  const size = 34
  for (let i = 0; i < 4; i += 1) {
    const horizontal = i % 2 === 0
    const sign = i < 2 ? -1 : 1
    const wx = horizontal ? x : x + sign * size
    const wz = horizontal ? z + sign * size : z
    for (let s = 0; s < 8; s += 1) {
      const t = (s + 0.5) / 8 - 0.5
      if (i === 3 && Math.abs(t) < 0.12) continue
      const sx = horizontal ? wx + t * size * 2 : wx
      const sz = horizontal ? wz : wz + t * size * 2
      b.box(sx, y + 4.5, sz, horizontal ? size / 4 : 1.8, 9, horizontal ? 1.8 : size / 4, 'pedra-escura', 0, true, true)
    }
    tower(b, x + (horizontal ? 0 : sign * size), z + (horizontal ? sign * size : 0), y, 15, 4.5)
  }
  b.box(x, y + 6, z - 16, 22, 12, 14, 'pedra', 0, true, true)
  b.box(x, y + 12.4, z - 16, 24, 1.4, 16, 'pedra-escura', 0, true, true)
  for (let i = 0; i < 3; i += 1) tower(b, x - 10 + i * 10, z - 9, y, 20, 3)
  arch(b, x, z + size, y, 6, 8)
  // Courtyard braziers and banners.
  for (const [bx, bz] of [[-10, 0], [10, 0], [-10, 12], [10, 12]]) brazier(b, x + bx, z + bz, terrain.heightAt(x + bx, z + bz))
  for (let i = 0; i < 4; i += 1) {
    b.box(x - 12 + i * 8, y + 6.4, z - 8.6, 1.2, 4.4, 0.08, 'tecido')
  }
  b.spots.boss = { x, z: z - 12, y }
  b.spots.chests.push({ x: x + 14, z: z - 14, y: terrain.heightAt(x + 14, z - 14), tier: 3 })
  b.spots.chests.push({ x: x - 14, z: z + 10, y: terrain.heightAt(x - 14, z + 10), tier: 2 })
  for (let i = 0; i < 5; i += 1) b.spots.enemies.push({ x: x + (rng() - 0.5) * 44, z: z + (rng() - 0.5) * 44, y })
  b.spots.portal = { x: x, z: z + 26, y: terrain.heightAt(x, z + 26) }
  b.spots.resources.push({ x: x + 20, z: z + 20, y: terrain.heightAt(x + 20, z + 20), kind: 'ferro' })
  const group = b.build()
  group.name = 'Castelo Abandonado'
  return { group, colliders: b.colliders, spots: b.spots }
}

export function buildDungeon(terrain: Terrain, x: number, z: number, seed: number): SiteResult {
  const y = terrain.heightAt(x, z)
  const b = new StructureBuilder(x, z, y)
  const rng = mulberry32(seed)
  // Sunken hall: stairs down into a pillared chamber.
  stairs(b, x, z + 14, y, 5, 8, 1.2, -0.6)
  const floorY = y - 4.8
  b.plane(x, floorY, z, 34, 30, 'pedra')
  for (let i = 0; i < 5; i += 1) {
    for (let j = 0; j < 4; j += 1) {
      const px = x - 13 + i * 6.5
      const pz = z - 10 + j * 6.5
      b.cylinder(px, floorY + 3, pz, 0.75, 6, 'pedra-escura', 8, true)
    }
  }
  for (let i = 0; i < 3; i += 1) brazier(b, x - 10 + i * 10, z - 12, floorY)
  // Back wall and boss alcove.
  b.box(x, floorY + 4, z - 16, 36, 8, 1.4, 'pedra-escura', 0, true, true)
  b.box(x, floorY + 3.5, z - 15.2, 8, 7, 0.8, 'pedra')
  b.spots.boss = { x, z: z - 10, y: floorY }
  b.spots.chests.push({ x: x + 12, z: z - 12, y: floorY, tier: 2 })
  b.spots.chests.push({ x: x - 12, z: z - 4, y: floorY, tier: 3 })
  for (let i = 0; i < 6; i += 1) b.spots.enemies.push({ x: x + (rng() - 0.5) * 26, z: z + (rng() - 0.5) * 24, y: floorY })
  b.spots.resources.push({ x: x - 15, z: z + 8, y: floorY, kind: 'prata' })
  b.spots.resources.push({ x: x + 15, z: z + 6, y: floorY, kind: 'cristal' })
  b.spots.portal = { x, z: z + 16, y }
  // Entrance arch above ground.
  arch(b, x, z + 16, y, 7, 5)
  const group = b.build()
  group.name = 'Masmorra'
  return { group, colliders: b.colliders, spots: b.spots }
}

export function buildTemple(terrain: Terrain, x: number, z: number, seed: number): SiteResult {
  const y = terrain.heightAt(x, z)
  const b = new StructureBuilder(x, z, y)
  const rng = mulberry32(seed)
  b.plane(x, y + 0.1, z, 26, 26, 'pedra')
  for (let i = 0; i < 4; i += 1) {
    const px = x + (i % 2 === 0 ? -8 : 8)
    const pz = z + (i < 2 ? -8 : 8)
    b.cylinder(px, y + 4, pz, 1, 8, 'pedra', 10, true)
    b.box(px, y + 8.4, pz, 2.4, 0.8, 2.4, 'pedra-escura')
  }
  b.box(x, y + 8.8, z, 20, 0.8, 20, 'pedra-escura', 0, false, true)
  b.cylinder(x, y + 1.2, z, 2.2, 0.6, 'pedra', 8)
  b.box(x, y + 2, z, 1.4, 1.2, 1.4, 'brilho')
  brazier(b, x - 7, z + 7, y)
  brazier(b, x + 7, z + 7, y)
  brazier(b, x, z - 8, y)
  b.spots.chests.push({ x, z: z - 3, y: y + 0.5, tier: 4 })
  for (let i = 0; i < 4; i += 1) b.spots.enemies.push({ x: x + (rng() - 0.5) * 20, z: z + (rng() - 0.5) * 20, y })
  b.spots.portal = { x, z: z + 12, y }
  const group = b.build()
  group.name = 'Templo Escondido'
  return { group, colliders: b.colliders, spots: b.spots }
}

export function buildRuins(terrain: Terrain, x: number, z: number, seed: number): SiteResult {
  const y = terrain.heightAt(x, z)
  const b = new StructureBuilder(x, z, y)
  const rng = mulberry32(seed)
  for (let i = 0; i < 12; i += 1) {
    const px = x + (rng() - 0.5) * 34
    const pz = z + (rng() - 0.5) * 34
    const height = 1.5 + rng() * 6
    b.cylinder(px, terrain.heightAt(px, pz) + height / 2, pz, 0.6 + rng() * 0.5, height, 'pedra', 8, true)
  }
  arch(b, x, z, y, 8, 6)
  b.box(x + 8, y + 0.6, z - 6, 6, 1.2, 4, 'pedra', 0, true, true)
  b.spots.chests.push({ x: x - 10, z: z + 8, y: terrain.heightAt(x - 10, z + 8), tier: 2 })
  b.spots.chests.push({ x: x + 12, z: z + 10, y: terrain.heightAt(x + 12, z + 10), tier: 3 })
  for (let i = 0; i < 5; i += 1) b.spots.enemies.push({ x: x + (rng() - 0.5) * 30, z: z + (rng() - 0.5) * 30, y })
  b.spots.resources.push({ x: x + 6, z: z + 14, y: terrain.heightAt(x + 6, z + 14), kind: 'prata' })
  b.spots.boss = rng() > 0.6 ? { x, z, y } : undefined
  const group = b.build()
  group.name = 'Ruínas Antigas'
  return { group, colliders: b.colliders, spots: b.spots }
}

export function buildCamp(terrain: Terrain, x: number, z: number, seed: number): SiteResult {
  const y = terrain.heightAt(x, z)
  const b = new StructureBuilder(x, z, y)
  const rng = mulberry32(seed)
  campfire(b, x, z, y)
  for (let i = 0; i < 4; i += 1) {
    const angle = (i / 4) * Math.PI * 2 + 0.4 + rng() * 0.5
    const tx = x + Math.cos(angle) * 8
    const tz = z + Math.sin(angle) * 8
    const ty = terrain.heightAt(tx, tz)
    b.cone(tx, ty + 1.7, tz, 2.4, 3.4, 'tecido', 4)
    b.cylinder(tx, ty + 1.9, tz, 0.08, 3.2, 'madeira')
    b.spots.enemies.push({ x: tx + 1.5, z: tz, y: ty })
  }
  b.box(x + 4, y + 0.5, z - 5, 1.6, 1, 1.2, 'madeira', 0, true, true)
  b.spots.chests.push({ x: x + 4, z: z - 5, y, tier: 1 })
  b.spots.npcs.push({ x: x - 3, z: z + 3, y })
  const group = b.build()
  group.name = 'Acampamento'
  return { group, colliders: b.colliders, spots: b.spots }
}

export function buildShrine(terrain: Terrain, x: number, z: number): SiteResult {
  const y = terrain.heightAt(x, z)
  const b = new StructureBuilder(x, z, y)
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * Math.PI * 2
    const px = x + Math.cos(angle) * 6
    const pz = z + Math.sin(angle) * 6
    b.cylinder(px, terrain.heightAt(px, pz) + 1.2, pz, 0.45, 2.4, 'pedra', 7, true)
  }
  b.cylinder(x, y + 0.3, z, 4.4, 0.6, 'pedra', 12, false)
  b.box(x, y + 1.6, z, 0.9, 2.4, 0.9, 'pedra-escura')
  b.cone(x, y + 3.4, z, 0.6, 1.2, 'brilho', 6)
  b.lights.push({ x, y: y + 3.4, z, color: '#8fe3ff', intensity: 8, distance: 22 })
  b.spots.portal = { x, z, y }
  b.spots.chests.push({ x: x + 5, z: z + 5, y: terrain.heightAt(x + 5, z + 5), tier: 1 })
  const group = b.build()
  group.name = 'Santuário'
  return { group, colliders: b.colliders, spots: b.spots }
}

export function buildTower(terrain: Terrain, x: number, z: number, seed: number): SiteResult {
  const y = terrain.heightAt(x, z)
  const b = new StructureBuilder(x, z, y)
  const rng = mulberry32(seed)
  tower(b, x, z, y, 22, 5)
  b.box(x, y + 2.2, z + 5.2, 2.4, 3.2, 0.6, 'madeira')
  b.spots.chests.push({ x, z: z + 6.4, y, tier: 2 + Math.floor(rng() * 3) })
  b.spots.enemies.push({ x: x + 4, z: z + 4, y: terrain.heightAt(x + 4, z + 4) })
  b.spots.enemies.push({ x: x - 4, z: z + 2, y: terrain.heightAt(x - 4, z + 2) })
  b.spots.resources.push({ x: x - 7, z: z - 6, y: terrain.heightAt(x - 7, z - 6), kind: 'mithril' })
  b.spots.portal = { x: x + 2, z: z + 8, y: terrain.heightAt(x + 2, z + 8) }
  const group = b.build()
  group.name = 'Torre em Ruínas'
  return { group, colliders: b.colliders, spots: b.spots }
}

export function buildPort(terrain: Terrain, x: number, z: number, seed: number): SiteResult {
  const y = terrain.heightAt(x, z)
  const b = new StructureBuilder(x, z, y)
  const rng = mulberry32(seed)
  for (let i = 0; i < 5; i += 1) {
    b.box(x - 8 + i * 4, y + 0.5, z + 8, 3.6, 0.4, 10, 'madeira', 0, false, true)
    b.cylinder(x - 8 + i * 4, y + 0.2, z + 13, 0.25, 3, 'madeira')
  }
  b.box(x + 10, y + 2, z - 2, 10, 4, 8, 'madeira', 0, true, true)
  b.box(x + 10, y + 4.4, z - 2, 11, 0.6, 9, 'telhado')
  b.spots.npcs.push({ x: x + 6, z: z + 2, y })
  b.spots.npcs.push({ x: x - 6, z: z + 6, y })
  b.spots.resources.push({ x: x - 2, z: z + 12, y: y, kind: 'pesca' })
  b.spots.resources.push({ x: x + 4, z: z + 12, y: y, kind: 'pesca' })
  b.spots.chests.push({ x: x + 14, z: z + 2, y, tier: 2 })
  b.spots.portal = { x: x + 2, z: z - 6, y: terrain.heightAt(x + 2, z - 6) }
  for (let i = 0; i < 3; i += 1) b.spots.enemies.push({ x: x - 14 + rng() * 8, z: z - 8 + rng() * 6, y })
  const group = b.build()
  group.name = 'Porto'
  return { group, colliders: b.colliders, spots: b.spots }
}

export function buildCave(terrain: Terrain, x: number, z: number, seed: number): SiteResult {
  const y = terrain.heightAt(x, z)
  const b = new StructureBuilder(x, z, y)
  const rng = mulberry32(seed)
  for (let i = 0; i < 9; i += 1) {
    const angle = Math.PI + (i / 8) * Math.PI
    b.cylinder(x + Math.cos(angle) * 7, y + 3, z + Math.sin(angle) * 7, 1.4, 7, 'pedra-escura', 6, true)
  }
  b.plane(x, y + 0.1, z, 16, 16, 'pedra-escura')
  for (let i = 0; i < 3; i += 1) brazier(b, x - 4 + i * 4, z - 4, y)
  b.spots.resources.push({ x: x + 3, z: z - 3, y, kind: 'ferro' })
  b.spots.resources.push({ x: x - 4, z: z - 2, y, kind: 'cristal' })
  b.spots.chests.push({ x: x + 5, z: z - 6, y, tier: 2 })
  for (let i = 0; i < 3; i += 1) b.spots.enemies.push({ x: x + (rng() - 0.5) * 10, z: z - 6 + (rng() - 0.5) * 6, y })
  const group = b.build()
  group.name = 'Caverna'
  return { group, colliders: b.colliders, spots: b.spots }
}

export function buildIslandSite(terrain: Terrain, x: number, z: number, seed: number): SiteResult {
  const y = terrain.heightAt(x, z)
  const b = new StructureBuilder(x, z, y)
  const rng = mulberry32(seed)
  b.plane(x, y + 0.15, z, 18, 18, 'pedra')
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2
    b.cylinder(x + Math.cos(angle) * 5, y + 2, z + Math.sin(angle) * 5, 0.7, 4, 'pedra', 8, true)
  }
  b.box(x, y + 1.2, z, 1.6, 2.4, 1.6, 'pedra-escura')
  b.cone(x, y + 3.2, z, 0.8, 1.4, 'brilho', 6)
  b.lights.push({ x, y: y + 3.4, z, color: '#b98cff', intensity: 9, distance: 24 })
  b.spots.chests.push({ x: x + 2, z: z + 2, y, tier: 5 })
  b.spots.boss = { x, z: z - 3, y }
  b.spots.portal = { x: x - 6, z: z + 6, y: terrain.heightAt(x - 6, z + 6) }
  for (let i = 0; i < 4; i += 1) b.spots.enemies.push({ x: x + (rng() - 0.5) * 14, z: z + (rng() - 0.5) * 14, y })
  const group = b.build()
  group.name = 'Ilha Secreta'
  return { group, colliders: b.colliders, spots: b.spots }
}
