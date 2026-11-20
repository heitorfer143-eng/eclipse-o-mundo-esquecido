import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { mulberry32 } from '../core/rng'
import type { BiomeId } from '../data/types'
import { colliderContains, type BoxCollider, type Collider } from './collision'
import type { Terrain } from './terrain'

export type MaterialKey =
  | 'pedra' | 'pedra-escura' | 'pedra-areia' | 'pedra-gelo' | 'pedra-obsidiana'
  | 'reboco' | 'madeira' | 'madeira-clara' | 'madeira-envelhecida'
  | 'telhado' | 'telhado-ocre' | 'telhado-frio'
  | 'tecido' | 'tecido-azul' | 'metal' | 'metal-dourado'
  | 'brilho' | 'brilho-azul' | 'brilho-violeta' | 'folha' | 'folha-seca' | 'terra' | 'agua' | 'vidro'

export const STRUCTURE_MATERIALS: Record<MaterialKey, THREE.Material> = {
  pedra: new THREE.MeshStandardMaterial({ color: '#a39e91', roughness: 0.93, flatShading: true }),
  'pedra-escura': new THREE.MeshStandardMaterial({ color: '#55545a', roughness: 0.96, flatShading: true }),
  'pedra-areia': new THREE.MeshStandardMaterial({ color: '#b89b70', roughness: 0.98, flatShading: true }),
  'pedra-gelo': new THREE.MeshStandardMaterial({ color: '#c2d3dc', roughness: 0.8, metalness: 0.06, flatShading: true }),
  'pedra-obsidiana': new THREE.MeshStandardMaterial({ color: '#393b45', roughness: 0.78, metalness: 0.12, flatShading: true }),
  reboco: new THREE.MeshStandardMaterial({ color: '#d0c2a5', roughness: 0.98, flatShading: true }),
  madeira: new THREE.MeshStandardMaterial({ color: '#65452f', roughness: 0.92, flatShading: true }),
  'madeira-clara': new THREE.MeshStandardMaterial({ color: '#98754e', roughness: 0.92, flatShading: true }),
  'madeira-envelhecida': new THREE.MeshStandardMaterial({ color: '#51463e', roughness: 0.98, flatShading: true }),
  telhado: new THREE.MeshStandardMaterial({ color: '#87483d', roughness: 0.87, flatShading: true }),
  'telhado-ocre': new THREE.MeshStandardMaterial({ color: '#ad713c', roughness: 0.9, flatShading: true }),
  'telhado-frio': new THREE.MeshStandardMaterial({ color: '#536a81', roughness: 0.84, flatShading: true }),
  tecido: new THREE.MeshStandardMaterial({ color: '#d0b57d', roughness: 1, flatShading: true, side: THREE.DoubleSide }),
  'tecido-azul': new THREE.MeshStandardMaterial({ color: '#5388a2', roughness: 1, flatShading: true, side: THREE.DoubleSide }),
  metal: new THREE.MeshStandardMaterial({ color: '#747b85', roughness: 0.42, metalness: 0.68, flatShading: true }),
  'metal-dourado': new THREE.MeshStandardMaterial({ color: '#b28a4d', roughness: 0.44, metalness: 0.58, flatShading: true }),
  brilho: new THREE.MeshStandardMaterial({ color: '#ffd38b', emissive: '#ff9b3d', emissiveIntensity: 1.8, roughness: 0.58 }),
  'brilho-azul': new THREE.MeshStandardMaterial({ color: '#b5efff', emissive: '#42bce2', emissiveIntensity: 1.65, roughness: 0.5 }),
  'brilho-violeta': new THREE.MeshStandardMaterial({ color: '#d9c2ff', emissive: '#8c55e8', emissiveIntensity: 1.7, roughness: 0.5 }),
  folha: new THREE.MeshStandardMaterial({ color: '#5b8b49', roughness: 1, flatShading: true }),
  'folha-seca': new THREE.MeshStandardMaterial({ color: '#737947', roughness: 1, flatShading: true }),
  terra: new THREE.MeshStandardMaterial({ color: '#594632', roughness: 1, flatShading: true }),
  agua: new THREE.MeshStandardMaterial({ color: '#367b8b', roughness: 0.22, metalness: 0.12, transparent: true, opacity: 0.82 }),
  vidro: new THREE.MeshStandardMaterial({ color: '#a8dce5', emissive: '#174351', emissiveIntensity: 0.28, roughness: 0.25, metalness: 0.18, transparent: true, opacity: 0.82, side: THREE.DoubleSide }),
}

/** Shared low-poly palettes keep each site recognizable while adapting to its biome. */
function paletteForBiome(biome: BiomeId): Partial<Record<MaterialKey, MaterialKey>> {
  if (biome === 'deserto') return { pedra: 'pedra-areia', 'pedra-escura': 'pedra-areia', reboco: 'pedra-areia', madeira: 'madeira-clara', telhado: 'telhado-ocre', tecido: 'tecido', metal: 'metal-dourado', brilho: 'brilho' }
  if (biome === 'neve' || biome === 'montanha') return { pedra: 'pedra-gelo', 'pedra-escura': 'pedra-obsidiana', reboco: 'pedra-gelo', madeira: 'madeira-envelhecida', telhado: 'telhado-frio', tecido: 'tecido-azul', brilho: 'brilho-azul' }
  if (biome === 'vulcanico' || biome === 'cinzas') return { pedra: 'pedra-obsidiana', 'pedra-escura': 'pedra-obsidiana', reboco: 'pedra-obsidiana', madeira: 'madeira-envelhecida', telhado: 'telhado', brilho: 'brilho-violeta', folha: 'folha-seca' }
  if (biome === 'pantano') return { pedra: 'pedra-escura', reboco: 'madeira-envelhecida', madeira: 'madeira-envelhecida', folha: 'folha-seca', tecido: 'tecido', brilho: 'brilho-azul' }
  if (biome === 'praia' || biome === 'ilha') return { pedra: 'pedra-areia', 'pedra-escura': 'pedra', reboco: 'pedra-areia', madeira: 'madeira-clara', telhado: 'telhado-ocre', tecido: 'tecido-azul', metal: 'metal-dourado', brilho: 'brilho-azul' }
  return {}
}

export type Spots = {
  npcs: { x: number; z: number; y: number }[]
  chests: { x: number; z: number; y: number; tier: number }[]
  enemies: { x: number; z: number; y: number }[]
  houses: { id: string; x: number; z: number; y: number }[]
  braziers: { x: number; z: number; y: number }[]
  resources: { x: number; z: number; y: number; kind: 'ferro' | 'prata' | 'mithril' | 'erva' | 'madeira' | 'pesca' | 'cristal' | 'pedra' }[]
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
  readonly spots: Spots = { npcs: [], chests: [], enemies: [], houses: [], braziers: [], resources: [], stations: [] }
  readonly lights: { x: number; y: number; z: number; color: string; intensity: number; distance: number }[] = []
  readonly objects: THREE.Object3D[] = []

  constructor(readonly originX: number, readonly originZ: number, readonly baseY: number, private readonly palette: Partial<Record<MaterialKey, MaterialKey>> = {}) {}

  private addGeometry(geometry: THREE.BufferGeometry, material: MaterialKey): void {
    // ExtrudeGeometry is non-indexed while many Three.js primitives are indexed; merge requires one convention.
    if (!geometry.index) {
      const position = geometry.getAttribute('position')
      geometry.setIndex(Array.from({ length: position.count }, (_, index) => index))
    }
    const key = this.palette[material] ?? material
    const list = this.parts.get(key) ?? []
    list.push(geometry)
    this.parts.set(key, list)
  }

  box(x: number, y: number, z: number, w: number, h: number, d: number, material: MaterialKey, rotate = 0, collide = false, solidTop = false): void {
    const geometry = new THREE.BoxGeometry(w, h, d)
    if (rotate) geometry.rotateY(rotate)
    geometry.translate(x, y, z)
    this.addGeometry(geometry, material)
    if (collide) {
      const extentX = rotate ? Math.abs(w * Math.cos(rotate)) + Math.abs(d * Math.sin(rotate)) : w
      const extentZ = rotate ? Math.abs(w * Math.sin(rotate)) + Math.abs(d * Math.cos(rotate)) : d
      this.addCollider(x - extentX / 2, x + extentX / 2, z - extentZ / 2, z + extentZ / 2, y + h / 2, y - h / 2, true, solidTop)
    }
  }

  cylinder(x: number, y: number, z: number, radius: number, height: number, material: MaterialKey, segments = 8, collide = false): void {
    const geometry = new THREE.CylinderGeometry(radius, radius * 1.05, height, segments)
    geometry.translate(x, y, z)
    this.addGeometry(geometry, material)
    if (collide) this.colliders.push({ kind: 'circle', x, z, radius, top: y + height / 2 })
  }

  cone(x: number, y: number, z: number, radius: number, height: number, material: MaterialKey, segments = 6): void {
    const geometry = new THREE.ConeGeometry(radius, height, segments)
    geometry.translate(x, y, z)
    this.addGeometry(geometry, material)
  }

  beam(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, radius: number, material: MaterialKey, segments = 5): void {
    const start = new THREE.Vector3(x1, y1, z1)
    const end = new THREE.Vector3(x2, y2, z2)
    const direction = end.clone().sub(start)
    const geometry = new THREE.CylinderGeometry(radius * 0.88, radius, direction.length(), segments)
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()))
    geometry.translate((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2)
    this.addGeometry(geometry, material)
  }

  gableRoof(x: number, y: number, z: number, width: number, depth: number, rise: number, material: MaterialKey): void {
    const lf = [-width / 2 + x, y, z - depth / 2]
    const rf = [width / 2 + x, y, z - depth / 2]
    const lr = [-width / 2 + x, y + rise, z]
    const rr = [width / 2 + x, y + rise, z]
    const lb = [-width / 2 + x, y, z + depth / 2]
    const rb = [width / 2 + x, y, z + depth / 2]
    const vertices = [lf, rr, rf, lf, lr, rr, lr, rb, rr, lr, lb, rb].flat()
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(24).fill(0), 2))
    geometry.computeVertexNormals()
    this.addGeometry(geometry, material)
  }

  gableFace(x: number, y: number, z: number, width: number, rise: number, material: MaterialKey): void {
    const shape = new THREE.Shape()
    shape.moveTo(-width / 2, 0)
    shape.lineTo(width / 2, 0)
    shape.lineTo(0, rise)
    shape.closePath()
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false, steps: 1 })
    geometry.translate(x, y, z - 0.04)
    this.addGeometry(geometry, material)
  }

  plane(x: number, y: number, z: number, w: number, d: number, material: MaterialKey, rotate = 0): void {
    const geometry = new THREE.PlaneGeometry(w, d)
    geometry.rotateX(-Math.PI / 2)
    geometry.rotateY(rotate)
    geometry.translate(x, y, z)
    this.addGeometry(geometry, material)
  }

  floor(x: number, y: number, z: number, w: number, d: number, material: MaterialKey): void {
    this.plane(x, y, z, w, d, material)
    this.addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y + 0.08, y - 0.08, false, true)
  }

  addCollider(minX: number, maxX: number, minZ: number, maxZ: number, top: number, bottom: number, blocking = true, solidTop = true, npcBlocking = false): BoxCollider {
    const collider: BoxCollider = { kind: 'box', minX, maxX, minZ, maxZ, top, bottom, blocking, solidTop, ...(npcBlocking ? { npcBlocking: true } : {}) }
    this.colliders.push(collider)
    return collider
  }

  addObject(object: THREE.Object3D): void {
    this.objects.push(object)
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
    for (const object of this.objects) group.add(object)
    // Emissive geometry carries small windows; reserve actual point lights for the brightest landmarks.
    const keyLights = [...this.lights].sort((a, b) => b.intensity - a.intensity).slice(0, 10)
    for (const light of keyLights) {
      const point = new THREE.PointLight(light.color, light.intensity, light.distance, 2)
      point.position.set(light.x, light.y, light.z)
      group.add(point)
    }
    this.parts.clear()
    return group
  }
}

function addHouseModel(b: StructureBuilder, template: THREE.Object3D, modelRole: string, x: number, z: number, y: number, w: number, d: number, h: number): boolean {
  const model = template.clone(true)
  model.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(model)
  const sourceSize = bounds.getSize(new THREE.Vector3())
  if ([sourceSize.x, sourceSize.y, sourceSize.z].some(value => !Number.isFinite(value) || value <= 0.01)) return false

  const scale = Math.min((w + 0.55) / sourceSize.x, (d + 0.55) / sourceSize.z, (h + 1.8) / sourceSize.y)
  if (!Number.isFinite(scale) || scale <= 0) return false
  const center = bounds.getCenter(new THREE.Vector3())
  const width = sourceSize.x * scale
  const depth = sourceSize.z * scale
  const height = sourceSize.y * scale
  model.scale.multiplyScalar(scale)
  model.position.set(x - center.x * scale, y - bounds.min.y * scale, z - center.z * scale)
  model.name = `house-model-${modelRole}`
  model.traverse(object => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.userData.sharedHouseAsset = true
  })
  b.addObject(model)

  // Keep the front doorway open and use measured model bounds for collision instead of a giant solid box.
  const wall = Math.min(0.5, Math.max(0.24, Math.min(width, depth) * 0.08))
  const halfWidth = width / 2
  const halfDepth = depth / 2
  const doorWidth = Math.min(1.35, width * 0.22)
  const top = y + height
  b.addCollider(x - halfWidth, x + halfWidth, z - halfDepth, z - halfDepth + wall, top, y, true, false)
  b.addCollider(x - halfWidth, x - halfWidth + wall, z - halfDepth, z + halfDepth, top, y, true, false)
  b.addCollider(x + halfWidth - wall, x + halfWidth, z - halfDepth, z + halfDepth, top, y, true, false)
  b.addCollider(x - halfWidth, x - doorWidth / 2, z + halfDepth - wall, z + halfDepth, top, y, true, false)
  b.addCollider(x + doorWidth / 2, x + halfWidth, z + halfDepth - wall, z + halfDepth, top, y, true, false)
  return true
}

function house(b: StructureBuilder, x: number, z: number, y: number, w: number, d: number, h: number, rng: () => number, roofColor: MaterialKey = 'telhado', houseModels: readonly (THREE.Object3D | null)[] = [], modelRole: 'cottage' | 'tavern' | 'blacksmith' = 'cottage', terrain?: Terrain): { x: number; z: number; y: number } {
  // Retain the three historical random draws so mob/resource coordinates after buildings stay unchanged.
  const rolls = [rng(), rng(), rng()]
  if (terrain) {
    // Buildings are rigid; pick a flat patch and keep the entire footprint above the ground.
    const candidates = [{ x, z }, ...Array.from({ length: 8 }, (_, i) => {
      const angle = i * Math.PI / 4
      return { x: x + Math.cos(angle) * 4, z: z + Math.sin(angle) * 4 }
    })]
    let best = candidates[0]
    let bestScore = Infinity
    for (const candidate of candidates) {
      const heights = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => terrain.heightAt(candidate.x + sx * w * 0.42, candidate.z + sz * d * 0.42))
      const relief = Math.max(...heights) - Math.min(...heights)
      const slope = typeof terrain.slopeAt === 'function' ? terrain.slopeAt(candidate.x, candidate.z) : 0
      const score = slope + relief * 0.12 + Math.hypot(candidate.x - x, candidate.z - z) * 0.012
      if (score < bestScore) { best = candidate; bestScore = score }
    }
    x = best.x
    z = best.z
    const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => ({
      x: x + sx * w * 0.42,
      z: z + sz * d * 0.42,
      y: terrain.heightAt(x + sx * w * 0.42, z + sz * d * 0.42),
    }))
    y = Math.max(...corners.map(corner => corner.y)) + 0.06
    for (const corner of corners) {
      const supportHeight = y - corner.y
      if (supportHeight > 0.25) b.cylinder(corner.x, corner.y + supportHeight / 2, corner.z, 0.24, supportHeight, 'pedra-escura', 6)
    }
  }
  // Doors remain usable by the player, but ambient NPCs must not wander through the doorway.
  b.addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y + h + 2.2, y - 0.2, false, false, true)
  const doorIndex = b.spots.houses.length + 1
  b.spots.houses.push({ id: `house-${doorIndex}`, x, z: z + d / 2 + 1.15, y })
  if (houseModels.length) {
    const roleIndex = { cottage: 0, tavern: 1, blacksmith: 2 }[modelRole]
    const fallback = houseModels[3 + roleIndex] ?? houseModels.find(model => model !== null)
    const template = houseModels[roleIndex] ?? fallback
    if (template && addHouseModel(b, template, modelRole, x, z, y, w, d, h)) return { x, z, y }
  }
  const wall = 0.32
  const frontZ = z + d / 2
  const doorWidth = Math.min(1.35, w * 0.22)
  const segmentWidth = (w - doorWidth) / 2
  // Raised stone footing, plaster infill and timber frame give houses a readable silhouette.
  b.box(x, y + 0.28, z, w + 0.55, 0.56, d + 0.55, 'pedra')
  b.box(x, y + h / 2, z - d / 2, w, h, wall, 'reboco', 0, true)
  b.box(x - w / 2, y + h / 2, z, wall, h, d, 'reboco', 0, true)
  b.box(x + w / 2, y + h / 2, z, wall, h, d, 'reboco', 0, true)
  b.box(x - doorWidth / 2 - segmentWidth / 2, y + h / 2, frontZ, segmentWidth, h, wall, 'reboco', 0, true)
  b.box(x + doorWidth / 2 + segmentWidth / 2, y + h / 2, frontZ, segmentWidth, h, wall, 'reboco', 0, true)
  b.box(x, y + h + 0.11, frontZ, doorWidth + 0.2, 0.22, wall, 'madeira', 0, true)
  // The visible door leaf is not a collider: interaction at the threshold teleports to the interior.
  b.box(x, y + 1.02, frontZ + 0.04, doorWidth - 0.12, 2.04, 0.1, 'madeira-envelhecida')
  // Corner posts and two timber belts break up broad wall surfaces without adding draw calls.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.box(x + sx * (w / 2 - 0.16), y + h / 2, z + sz * (d / 2 - 0.16), 0.3, h + 0.08, 0.3, 'madeira')
  }
  b.box(x, y + 0.34, z, w + 0.72, 0.16, d + 0.72, 'madeira-clara')
  b.box(x, y + h - 0.14, z, w + 0.24, 0.22, d + 0.24, 'madeira')
  // Side windows: dark frame, cool glass and a warm inner pane, all static/merged geometry.
  for (const sz of [-1, 1]) {
    const windowZ = z + sz * d * 0.22
    b.box(x + w / 2 + 0.02, y + h * 0.59, windowZ, 0.12, 0.86, 0.92, 'madeira-envelhecida')
    b.box(x + w / 2 + 0.09, y + h * 0.59, windowZ, 0.04, 0.62, 0.66, rolls[sz < 0 ? 0 : 1] > 0.5 ? 'vidro' : 'brilho')
    b.box(x + w / 2 + 0.12, y + h * 0.59, windowZ, 0.07, 0.08, 0.86, 'madeira-clara')
  }
  const roofRise = 1.65 + rolls[2] * 0.35
  const roofY = y + h - 0.03
  b.gableRoof(x, roofY, z, w + 1, d + 1, roofRise, roofColor)
  b.gableFace(x, roofY, z - d / 2 - 0.5, w + 1, roofRise, 'reboco')
  b.gableFace(x, roofY, z + d / 2 + 0.5, w + 1, roofRise, 'reboco')
  b.beam(x - w / 2 - 0.5, roofY, z, x + w / 2 + 0.5, roofY, z, 0.12, 'madeira-envelhecida')
  b.beam(x - w / 2 - 0.5, roofY, z - d / 2 - 0.48, x - w / 2 - 0.5, roofY + roofRise, z, 0.1, 'madeira')
  b.beam(x + w / 2 + 0.5, roofY, z - d / 2 - 0.48, x + w / 2 + 0.5, roofY + roofRise, z, 0.1, 'madeira')
  b.beam(x - w / 2 - 0.5, roofY, z + d / 2 + 0.48, x - w / 2 - 0.5, roofY + roofRise, z, 0.1, 'madeira')
  b.beam(x + w / 2 + 0.5, roofY, z + d / 2 + 0.48, x + w / 2 + 0.5, roofY + roofRise, z, 0.1, 'madeira')
  // Keep the prior walkable roof footprint; the decorative roof itself remains lightweight.
  b.addCollider(x - w / 2 - 0.5, x + w / 2 + 0.5, z - d / 2 - 0.5, z + d / 2 + 0.5, roofY + 0.5, roofY, true, true)
  b.box(x + w * 0.27, roofY + roofRise * 0.55, z - d * 0.08, 0.62, 1.5, 0.62, 'pedra-escura')
  return { x, z, y }
}

function keepNpcsOutsideHouses(b: StructureBuilder, terrain: Terrain): void {
  const exclusion = b.colliders.filter((collider): collider is BoxCollider => collider.kind === 'box' && collider.npcBlocking === true)
  if (!exclusion.length) return
  for (const npc of b.spots.npcs) {
    if (!exclusion.some(collider => colliderContains(collider, npc.x, npc.z))) continue
    let placed = false
    for (let radius = 1.5; radius <= 8 && !placed; radius += 0.5) {
      for (let step = 0; step < 16; step += 1) {
        const angle = (step / 16) * Math.PI * 2
        const candidateX = npc.x + Math.cos(angle) * radius
        const candidateZ = npc.z + Math.sin(angle) * radius
        if (exclusion.some(collider => colliderContains(collider, candidateX, candidateZ))) continue
        npc.x = candidateX
        npc.z = candidateZ
        npc.y = terrain.heightAt(candidateX, candidateZ)
        placed = true
        break
      }
    }
  }
}

function fence(b: StructureBuilder, x1: number, z1: number, x2: number, z2: number, y: number): void {
  const length = Math.hypot(x2 - x1, z2 - z1)
  const count = Math.max(1, Math.round(length / 2.4))
  for (let i = 0; i <= count; i += 1) {
    const t = i / count
    b.box(x1 + (x2 - x1) * t, y + 0.7, z1 + (z2 - z1) * t, 0.18, 1.4, 0.18, 'madeira')
  }
  b.beam(x1, y + 0.55, z1, x2, y + 0.55, z2, 0.07, 'madeira-clara')
  b.beam(x1, y + 1.18, z1, x2, y + 1.18, z2, 0.08, 'madeira')
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
  b.cylinder(x, y + 0.28, z, 1.75, 0.56, 'pedra-escura', 12, true)
  b.cylinder(x, y + 0.62, z, 1.48, 0.5, 'pedra', 12, true)
  b.cylinder(x, y + 0.91, z, 1.17, 0.08, 'agua', 12)
  b.cylinder(x, y + 1.13, z, 1.52, 0.16, 'pedra', 12)
  b.box(x - 1.42, y + 1.72, z, 0.22, 2.1, 0.22, 'madeira')
  b.box(x + 1.42, y + 1.72, z, 0.22, 2.1, 0.22, 'madeira')
  b.beam(x - 1.55, y + 2.86, z, x + 1.55, y + 2.86, z, 0.1, 'madeira-clara')
  b.beam(x, y + 2.3, z - 0.05, x, y + 2.3, z + 0.05, 0.09, 'metal')
  b.beam(x, y + 2.18, z, x, y + 0.9, z, 0.035, 'metal')
  b.box(x, y + 0.92, z, 0.46, 0.42, 0.46, 'madeira-clara')
}

function marketStall(b: StructureBuilder, x: number, z: number, y: number, rng: () => number): void {
  b.box(x, y + 0.9, z, 2.6, 0.15, 1.3, 'madeira', 0, true, true)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(x + sx * 1.2, y + 1.55, z + sz * 0.76, 0.14, 1.5, 0.14, 'madeira')
  b.gableRoof(x, y + 2.22, z, 3.2, 2.25, 0.8, 'tecido')
  b.beam(x - 1.6, y + 2.22, z, x + 1.6, y + 2.22, z, 0.075, 'madeira-clara')
  for (let i = 0; i < 5; i += 1) b.box(x - 1.1 + i * 0.55, y + 1.1, z + (rng() - 0.5) * 0.42, 0.28, 0.3, 0.28, rng() > 0.5 ? 'folha' : 'metal-dourado')
  b.lights.push({ x, y: y + 2.1, z, color: '#ffd08a', intensity: 1.6, distance: 7 })
}

function tower(b: StructureBuilder, x: number, z: number, y: number, height: number, radius: number): void {
  b.cylinder(x, y + 0.38, z, radius + 0.55, 0.76, 'pedra-escura', 12, true)
  b.cylinder(x, y + height / 2, z, radius, height, 'pedra', 10, true)
  b.cylinder(x, y + height - 0.8, z, radius + 0.12, 0.32, 'pedra-escura', 10)
  b.cylinder(x, y + height + 0.18, z, radius + 0.42, 0.52, 'pedra-escura', 10)
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2
    const cx = x + Math.cos(a) * (radius + 0.08)
    const cz = z + Math.sin(a) * (radius + 0.08)
    b.box(cx, y + height + 0.72, cz, 0.62, 0.75, 0.62, i % 2 ? 'pedra' : 'pedra-escura')
  }
  for (const level of [0.35, 0.67]) {
    b.box(x, y + height * level, z + radius + 0.04, 0.42, 1.05, 0.12, 'brilho')
  }
  // Four shallow buttresses visually anchor the tall silhouette to the ground.
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    b.beam(x + Math.cos(a) * (radius + 0.85), y + 0.2, z + Math.sin(a) * (radius + 0.85), x + Math.cos(a) * (radius - 0.2), y + height * 0.62, z + Math.sin(a) * (radius - 0.2), 0.2, 'pedra-escura')
  }
}

function arch(b: StructureBuilder, x: number, z: number, y: number, width: number, height: number, rotate = 0): void {
  b.box(x - width / 2, y + height / 2, z, 0.9, height, 1, 'pedra-escura', rotate, true)
  b.box(x + width / 2, y + height / 2, z, 0.9, height, 1, 'pedra-escura', rotate, true)
  b.box(x - width / 2, y + 0.35, z, 1.25, 0.7, 1.3, 'pedra', rotate)
  b.box(x + width / 2, y + 0.35, z, 1.25, 0.7, 1.3, 'pedra', rotate)
  b.box(x, y + height + 0.25, z, width + 1.8, 0.72, 1.2, 'pedra', rotate, true)
  b.box(x, y + height + 0.74, z, width * 0.6, 0.22, 0.62, 'metal-dourado', rotate)
}

function stairs(b: StructureBuilder, x: number, z: number, y: number, width: number, steps: number, depth: number, rise: number): void {
  const stepHeight = Math.max(0.08, Math.abs(rise))
  for (let i = 0; i < steps; i += 1) {
    b.box(x, y + rise * (i + 0.5), z + depth * i, width, stepHeight, Math.abs(depth), 'pedra', 0, true, true)
  }
}

/** Seedless paving follows the sampled ground and adds visual guidance without changing collision. */
function footpath(b: StructureBuilder, terrain: Terrain, x1: number, z1: number, x2: number, z2: number, width = 2.2, stride = 2.8): void {
  const dx = x2 - x1
  const dz = z2 - z1
  const length = Math.hypot(dx, dz)
  const count = Math.max(1, Math.ceil(length / stride))
  const angle = -Math.atan2(dz, dx)
  for (let i = 0; i < count; i += 1) {
    const t = (i + 0.5) / count
    const px = x1 + dx * t
    const pz = z1 + dz * t
    const py = terrain.heightAt(px, pz)
    b.box(px, py + 0.065, pz, Math.min(stride * 0.82, length / count), 0.13, width, i % 3 === 0 ? 'pedra-areia' : 'pedra', angle)
  }
}

export type SiteResult = { group: THREE.Group; colliders: Collider[]; spots: Spots }

/** A village of timber houses around a well, with a forge, shrine and fields. */
export function buildVillage(terrain: Terrain, x: number, z: number, seed: number, name: string, houseModels: readonly (THREE.Object3D | null)[] = []): SiteResult {
  const y = terrain.heightAt(x, z)
  const b = new StructureBuilder(x, z, y, paletteForBiome(terrain.biomeAt(x, z, y)))
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
    house(b, hx, hz, hy, 5.5 + rng() * 2.5, 5 + rng() * 2, 3.2 + rng() * 0.9, rng, 'telhado', houseModels, 'cottage', terrain)
    const entrance = b.spots.houses[b.spots.houses.length - 1]
    const residentX = entrance.x + (i % 2 === 0 ? 1 : -1) * 1.05
    b.spots.npcs.push({ x: residentX, z: entrance.z + 0.12, y: terrain.heightAt(residentX, entrance.z + 0.12) })
  }
  // Forge with an anvil and a crafting station.
  const fx = x + 13
  const fz = z - 9
  const fy = terrain.heightAt(fx, fz)
  const forge = house(b, fx, fz, fy, 6, 5, 3.2, rng, 'telhado', houseModels, 'blacksmith', terrain)
  b.box(forge.x - 1.9, forge.y + 2.1, forge.z - 1.3, 0.8, 2.1, 0.8, 'pedra-escura')
  b.cone(forge.x - 1.9, forge.y + 3.4, forge.z - 1.3, 0.55, 1.1, 'pedra-escura', 6)
  b.box(forge.x + 1.6, forge.y + 1.05, forge.z + 1.2, 0.9, 0.6, 0.5, 'metal')
  b.box(forge.x - 1.4, forge.y + 0.8, forge.z + 1.4, 1.2, 0.8, 0.9, 'pedra-escura')
  b.lights.push({ x: forge.x, y: forge.y + 2.4, z: forge.z + 2, color: '#ff8a3c', intensity: 5, distance: 12 })
  b.spots.stations.push({ x: forge.x + 3.4, z: forge.z + 2.6, y: forge.y, kind: 'forja' })
  b.spots.npcs.push({ x: forge.x + 3.4, z: forge.z + 3.6, y: terrain.heightAt(forge.x + 3.4, forge.z + 3.6) })
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
  footpath(b, terrain, x, z, fx, fz + 3)
  footpath(b, terrain, x, z, ax, az + 2)
  footpath(b, terrain, x, z, sx, sz)
  // Fields and fences.
  fence(b, x - 26, z - 20, x - 8, z - 20, y)
  fence(b, x - 26, z - 20, x - 26, z - 4, y)
  for (let i = 0; i < 10; i += 1) {
    const cx = x - 24 + (i % 5) * 3.4
    const cz = z - 18 + Math.floor(i / 5) * 3.2
    const cy = terrain.heightAt(cx, cz)
    b.box(cx, cy + 0.12, cz, 2.8, 0.24, 2.5, 'madeira-envelhecida')
    b.box(cx, cy + 0.27, cz, 2.4, 0.12, 2.1, 'terra')
    for (let row = 0; row < 3; row += 1) b.box(cx - 0.75 + row * 0.75, cy + 0.55, cz, 0.3, 0.55, 1.5, 'folha')
  }
  b.spots.chests.push({ x: x + 9, z: z + 13, y: terrain.heightAt(x + 9, z + 13), tier: 1 })
  b.spots.resources.push({ x: x - 20, z: z + 4, y: terrain.heightAt(x - 20, z + 4), kind: 'erva' })
  for (let i = 0; i < 3; i += 1) {
    const ex = x + 26 + rng() * 10
    const ez = z + 8 + rng() * 14
    b.spots.enemies.push({ x: ex, z: ez, y: terrain.heightAt(ex, ez) })
  }
  b.spots.resources.push({ x: x - 24, z: z + 8, y: terrain.heightAt(x - 24, z + 8), kind: 'erva' })
  b.spots.resources.push({ x: x - 16, z: z + 8, y: terrain.heightAt(x - 16, z + 8), kind: 'erva' })
  b.spots.resources.push({ x: x + 18, z: z + 16, y: terrain.heightAt(x + 18, z + 16), kind: 'madeira' })
  b.spots.resources.push({ x: x - 16, z: z - 16, y: terrain.heightAt(x - 16, z - 16), kind: 'ferro' })
  b.spots.resources.push({ x: x - 11, z: z - 18, y: terrain.heightAt(x - 11, z - 18), kind: 'pedra' })
  b.spots.npcs.push({ x: sx + 2.5, z: sz + 1, y: sy })
  b.spots.npcs.push({ x: x - 2, z: z + 4, y })
  b.spots.npcs.push({ x: x + 4, z: z - 3, y })
  keepNpcsOutsideHouses(b, terrain)
  const group = b.build()
  group.name = name
  return { group, colliders: b.colliders, spots: b.spots }
}

/** The great city of Aster: walls, gate, keep, market square and every shop. */
export function buildCity(terrain: Terrain, x: number, z: number, seed: number, houseModels: readonly (THREE.Object3D | null)[] = []): SiteResult {
  const y = terrain.heightAt(x, z)
  const b = new StructureBuilder(x, z, y, paletteForBiome(terrain.biomeAt(x, z, y)))
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
      b.box(sx, y + wallH + 0.25, sz, horizontal ? length / segments : 1.8, 0.5, horizontal ? 1.8 : length / segments, 'pedra-escura')
      if (s % 2 === 0) b.box(sx, y + wallH + 0.76, sz, horizontal ? 1.05 : 1.8, 0.55, horizontal ? 1.8 : 1.05, 'pedra')
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
  for (let i = 0; i < 8; i += 1) {
    const cx = x - 11 + i * 3.15
    b.box(cx, y + 15.55, z - 30, 1.15, 0.75, 1.2, 'pedra')
    b.box(cx, y + 15.55, z - 21.7, 1.15, 0.75, 1.2, 'pedra')
  }
  // Great hall / tavern.
  house(b, x - 24, z + 6, y, 14, 10, 5.2, rng, 'telhado', houseModels, 'tavern', terrain)
  house(b, x + 26, z + 4, y, 12, 9, 4.8, rng, 'telhado', houseModels, 'cottage', terrain)
  // Market square: stalls around a fountain.
  b.cylinder(x, y + 0.5, z + 6, 6, 0.8, 'pedra', 14, false)
  b.cylinder(x, y + 0.9, z + 6, 5.2, 0.25, 'agua', 14)
  b.cylinder(x, y + 1.6, z + 6, 0.7, 2.4, 'pedra', 8, true)
  b.cylinder(x, y + 2.9, z + 6, 2.1, 0.4, 'pedra', 10)
  b.cylinder(x, y + 3.35, z + 6, 0.34, 0.5, 'brilho', 8)
  b.cylinder(x, y + 3.62, z + 6, 0.18, 0.12, 'agua', 8)
  b.lights.push({ x, y: y + 3.4, z: z + 6, color: '#9fd8ff', intensity: 6, distance: 20 })
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2
    marketStall(b, x + Math.cos(angle) * 14, z + 6 + Math.sin(angle) * 12, y, rng)
    b.spots.npcs.push({ x: x + Math.cos(angle) * 16, z: z + 6 + Math.sin(angle) * 14, y })
  }
  // Blacksmith, alchemy and temple.
  const cityForge = house(b, x + 20, z - 12, y, 12, 9, 5.8, rng, 'telhado', houseModels, 'blacksmith', terrain)
  b.box(cityForge.x - 4, cityForge.y + 1.4, cityForge.z + 4, 1.6, 1, 1.2, 'metal')
  b.box(cityForge.x, cityForge.y + 1.2, cityForge.z + 5.2, 0.7, 0.18, 1.4, 'metal-dourado')
  b.lights.push({ x: cityForge.x, y: cityForge.y + 3.6, z: cityForge.z + 4, color: '#ff8a3c', intensity: 7, distance: 16 })
  b.spots.stations.push({ x: cityForge.x + 4, z: cityForge.z + 6, y: cityForge.y, kind: 'forja' })
  b.spots.npcs.push({ x: cityForge.x + 4, z: cityForge.z + 8, y: terrain.heightAt(cityForge.x + 4, cityForge.z + 8) })
  house(b, x - 20, z - 12, y, 9, 8, 5.2, rng, 'telhado', houseModels, 'cottage', terrain)
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
    b.cylinder(px, y + 0.65, pz, 0.8, 0.5, 'pedra-escura', 8)
  }
  b.cylinder(x + 2, y + 0.95, z - 8, 5.2, 0.28, 'metal-dourado', 12)
  b.box(x + 2, y + 1.7, z - 8, 2.1, 1.2, 2.1, 'pedra-escura')
  stairs(b, x + 2, z + 4, y, 8, 4, -0.9, 0.18)
  b.spots.portal = { x: x + 2, z: z - 2, y }
  b.spots.npcs.push({ x: x + 6, z: z - 4, y })
  b.spots.chests.push({ x: x - 8, z: z - 16, y: terrain.heightAt(x - 8, z - 16), tier: 3 })
  b.spots.resources.push({ x: x + 30, z: z + 18, y: terrain.heightAt(x + 30, z + 18), kind: 'madeira' })
  b.spots.resources.push({ x: x - 32, z: z + 22, y: terrain.heightAt(x - 32, z + 22), kind: 'ferro' })
  b.spots.resources.push({ x: x - 26, z: z + 25, y: terrain.heightAt(x - 26, z + 25), kind: 'pedra' })
  footpath(b, terrain, x, z + size, x, z + 8, 3.4, 3.4)
  for (let i = 0; i < 4; i += 1) {
    const ex = x + 40 + rng() * 20
    const ez = z - 30 - rng() * 20
    b.spots.enemies.push({ x: ex, z: ez, y: terrain.heightAt(ex, ez) })
  }
  keepNpcsOutsideHouses(b, terrain)
  const group = b.build()
  group.name = 'Aster'
  return { group, colliders: b.colliders, spots: b.spots }
}

export function buildCastle(terrain: Terrain, x: number, z: number, seed: number): SiteResult {
  const y = terrain.heightAt(x, z)
  const b = new StructureBuilder(x, z, y, paletteForBiome(terrain.biomeAt(x, z, y)))
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
      b.box(sx, y + 9.35, sz, horizontal ? 2.4 : 2.0, 0.45, horizontal ? 2.0 : 2.4, 'pedra')
      if (s % 2 === 0) b.box(sx, y + 10.05, sz, horizontal ? 1.0 : 1.8, 0.9, horizontal ? 1.8 : 1.0, 'pedra-escura')
    }
    tower(b, x + (horizontal ? 0 : sign * size), z + (horizontal ? sign * size : 0), y, 15, 4.5)
  }
  b.box(x, y + 6, z - 16, 22, 12, 14, 'pedra', 0, true, true)
  b.box(x, y + 12.4, z - 16, 24, 1.4, 16, 'pedra-escura', 0, true, true)
  for (let i = 0; i < 6; i += 1) b.box(x - 9 + i * 3.6, y + 13.35, z - 16, 1.2, 0.62, 1.2, 'pedra')
  for (let i = 0; i < 3; i += 1) tower(b, x - 10 + i * 10, z - 9, y, 20, 3)
  arch(b, x, z + size, y, 6, 8)
  // Courtyard braziers and banners.
  for (const [bx, bz] of [[-10, 0], [10, 0], [-10, 12], [10, 12]]) brazier(b, x + bx, z + bz, terrain.heightAt(x + bx, z + bz))
  for (let i = 0; i < 4; i += 1) {
    b.box(x - 12 + i * 8, y + 6.4, z - 8.6, 1.2, 4.4, 0.08, i % 2 ? 'tecido-azul' : 'tecido')
    b.box(x - 12 + i * 8, y + 8.5, z - 8.52, 0.55, 0.45, 0.1, 'brilho')
  }
  b.spots.boss = { x, z: z - 12, y }
  b.spots.chests.push({ x: x + 14, z: z - 14, y: terrain.heightAt(x + 14, z - 14), tier: 3 })
  b.spots.chests.push({ x: x - 14, z: z + 10, y: terrain.heightAt(x - 14, z + 10), tier: 2 })
  for (let i = 0; i < 5; i += 1) {
    const ex = x + (rng() - 0.5) * 44
    const ez = z + (rng() - 0.5) * 44
    b.spots.enemies.push({ x: ex, z: ez, y: terrain.heightAt(ex, ez) })
  }
  b.spots.portal = { x: x, z: z + 26, y: terrain.heightAt(x, z + 26) }
  b.spots.resources.push({ x: x + 20, z: z + 20, y: terrain.heightAt(x + 20, z + 20), kind: 'ferro' })
  const group = b.build()
  group.name = 'Castelo Abandonado'
  return { group, colliders: b.colliders, spots: b.spots }
}

export function buildDungeon(terrain: Terrain, x: number, z: number, seed: number): SiteResult {
  const y = terrain.heightAt(x, z)
  const b = new StructureBuilder(x, z, y, paletteForBiome(terrain.biomeAt(x, z, y)))
  const rng = mulberry32(seed)
  // Open-air crypt: the chamber is visible above ground, and its short stair is actually walkable.
  const floorY = y + 0.15
  stairs(b, x, z + 16, y + 0.05, 5, 4, -1, 0.04)
  b.floor(x, floorY, z, 34, 30, 'pedra')
  for (let i = 0; i < 5; i += 1) {
    for (let j = 0; j < 4; j += 1) {
      const px = x - 13 + i * 6.5
      const pz = z - 10 + j * 6.5
      b.cylinder(px, floorY + 3, pz, 0.75, 6, 'pedra-escura', 8, true)
      b.cylinder(px, floorY + 0.35, pz, 1.05, 0.7, 'pedra', 8)
      b.cylinder(px, floorY + 5.78, pz, 1.08, 0.55, 'pedra', 8)
    }
  }
  b.cylinder(x, floorY + 0.08, z, 3.6, 0.16, 'metal-dourado', 12)
  b.cylinder(x, floorY + 0.18, z, 2.55, 0.08, 'brilho-violeta', 12)
  for (let i = 0; i < 3; i += 1) brazier(b, x - 10 + i * 10, z - 12, floorY)
  // Back wall and boss alcove.
  b.box(x, floorY + 4, z - 16, 36, 8, 1.4, 'pedra-escura', 0, true, true)
  b.box(x, floorY + 3.5, z - 15.2, 8, 7, 0.8, 'pedra')
  b.box(x, floorY + 1.35, z - 14.68, 3.2, 2.7, 0.16, 'brilho-violeta')
  b.box(x - 8, floorY + 6.2, z - 15.15, 1.2, 1.1, 0.22, 'metal-dourado')
  b.box(x + 8, floorY + 6.2, z - 15.15, 1.2, 1.1, 0.22, 'metal-dourado')
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
  const b = new StructureBuilder(x, z, y, paletteForBiome(terrain.biomeAt(x, z, y)))
  const rng = mulberry32(seed)
  b.floor(x, y + 0.1, z, 26, 26, 'pedra')
  for (let i = 0; i < 4; i += 1) {
    const px = x + (i % 2 === 0 ? -8 : 8)
    const pz = z + (i < 2 ? -8 : 8)
    b.cylinder(px, y + 4, pz, 1, 8, 'pedra', 10, true)
    b.box(px, y + 8.4, pz, 2.4, 0.8, 2.4, 'pedra-escura')
    b.cylinder(px, y + 0.6, pz, 1.35, 0.8, 'pedra-escura', 10)
  }
  b.box(x, y + 8.8, z, 21, 0.55, 21, 'pedra-escura', 0, false, true)
  b.gableRoof(x, y + 9.05, z, 22.5, 22.5, 3.5, 'pedra')
  b.gableFace(x, y + 9.05, z - 11.25, 22.5, 3.5, 'pedra-escura')
  b.gableFace(x, y + 9.05, z + 11.25, 22.5, 3.5, 'pedra-escura')
  b.beam(x - 11.2, y + 9.05, z, x + 11.2, y + 9.05, z, 0.16, 'metal-dourado')
  b.cylinder(x, y + 1.2, z, 2.2, 0.6, 'pedra', 8)
  b.box(x, y + 2, z, 1.4, 1.2, 1.4, 'brilho')
  b.cylinder(x, y + 0.62, z, 3.2, 0.18, 'metal-dourado', 12)
  stairs(b, x, z + 13, y, 8, 4, -1.1, 0.12)
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

export function buildRuins(terrain: Terrain, x: number, z: number, seed: number, enemyCount = 5, chestTiers: [number, number] = [2, 3]): SiteResult {
  const y = terrain.heightAt(x, z)
  const b = new StructureBuilder(x, z, y, paletteForBiome(terrain.biomeAt(x, z, y)))
  const rng = mulberry32(seed)
  for (let i = 0; i < 12; i += 1) {
    const px = x + (rng() - 0.5) * 34
    const pz = z + (rng() - 0.5) * 34
    const ground = terrain.heightAt(px, pz)
    const height = 1.1 + rng() * 5.4
    const radius = 0.55 + rng() * 0.5
    b.cylinder(px, ground + height / 2, pz, radius, height, i % 3 === 0 ? 'pedra-escura' : 'pedra', 7, true)
    if (i % 3 !== 0) b.cylinder(px, ground + height + 0.12, pz, radius * 1.2, 0.24, 'pedra-areia', 7)
    else b.beam(px - 0.2, ground + height, pz, px + 0.9, ground + height + 0.65, pz + 0.35, radius * 0.42, 'pedra-escura')
    b.box(px + 1.1, ground + 0.16, pz - 0.7, 0.8 + rng(), 0.32, 0.7 + rng() * 0.6, 'pedra')
  }
  arch(b, x, z, y, 8, 6)
  b.box(x + 8, y + 0.6, z - 6, 6, 1.2, 4, 'pedra', 0, true, true)
  b.spots.chests.push({ x: x - 10, z: z + 8, y: terrain.heightAt(x - 10, z + 8), tier: chestTiers[0] })
  b.spots.chests.push({ x: x + 12, z: z + 10, y: terrain.heightAt(x + 12, z + 10), tier: chestTiers[1] })
  for (let i = 0; i < enemyCount; i += 1) {
    const ex = x + (rng() - 0.5) * 30
    const ez = z + (rng() - 0.5) * 30
    b.spots.enemies.push({ x: ex, z: ez, y: terrain.heightAt(ex, ez) })
  }
  b.spots.resources.push({ x: x + 6, z: z + 14, y: terrain.heightAt(x + 6, z + 14), kind: 'prata' })
  b.spots.boss = rng() > 0.6 ? { x, z, y } : undefined
  const group = b.build()
  group.name = 'Ruínas Antigas'
  return { group, colliders: b.colliders, spots: b.spots }
}

export function buildCamp(terrain: Terrain, x: number, z: number, seed: number): SiteResult {
  const y = terrain.heightAt(x, z)
  const b = new StructureBuilder(x, z, y, paletteForBiome(terrain.biomeAt(x, z, y)))
  const rng = mulberry32(seed)
  campfire(b, x, z, y)
  for (let i = 0; i < 4; i += 1) {
    const angle = (i / 4) * Math.PI * 2 + 0.4 + rng() * 0.5
    const tx = x + Math.cos(angle) * 8
    const tz = z + Math.sin(angle) * 8
    const ty = terrain.heightAt(tx, tz)
    b.cone(tx, ty + 1.7, tz, 2.4, 3.4, i % 2 === 0 ? 'tecido' : 'tecido-azul', 5)
    b.cylinder(tx, ty + 1.9, tz, 0.08, 3.2, 'madeira')
    b.beam(tx - 1.8, ty + 0.15, tz - 1.7, tx - 2.8, ty + 0.05, tz - 2.4, 0.025, 'madeira-clara')
    b.beam(tx + 1.8, ty + 0.15, tz + 1.7, tx + 2.8, ty + 0.05, tz + 2.4, 0.025, 'madeira-clara')
    const ex = tx + 1.5
    b.spots.enemies.push({ x: ex, z: tz, y: terrain.heightAt(ex, tz) })
  }
  b.box(x + 4, y + 0.5, z - 5, 1.6, 1, 1.2, 'madeira', 0, true, true)
  b.box(x - 5, y + 0.17, z + 2, 2.4, 0.34, 0.8, 'tecido-azul')
  b.box(x - 4.9, y + 0.42, z + 2, 1.5, 0.16, 0.55, 'madeira-clara')
  b.spots.chests.push({ x: x + 4, z: z - 5, y: terrain.heightAt(x + 4, z - 5), tier: 1 })
  b.spots.npcs.push({ x: x - 3, z: z + 3, y: terrain.heightAt(x - 3, z + 3) })
  const group = b.build()
  group.name = 'Acampamento'
  return { group, colliders: b.colliders, spots: b.spots }
}

export function buildShrine(terrain: Terrain, x: number, z: number): SiteResult {
  const y = terrain.heightAt(x, z)
  const b = new StructureBuilder(x, z, y, paletteForBiome(terrain.biomeAt(x, z, y)))
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * Math.PI * 2
    const px = x + Math.cos(angle) * 6
    const pz = z + Math.sin(angle) * 6
    b.cylinder(px, terrain.heightAt(px, pz) + 1.2, pz, 0.45, 2.4, 'pedra', 7, true)
  }
  b.cylinder(x, y + 0.3, z, 4.4, 0.6, 'pedra', 12, false)
  b.cylinder(x, y + 0.64, z, 3.75, 0.12, 'metal-dourado', 12)
  b.addCollider(x - 4.4, x + 4.4, z - 4.4, z + 4.4, y + 0.62, y + 0.3, false, true)
  b.box(x, y + 1.6, z, 0.9, 2.4, 0.9, 'pedra-escura')
  b.cone(x, y + 3.4, z, 0.6, 1.2, 'brilho', 6)
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * Math.PI * 2
    b.box(x + Math.cos(angle) * 2.2, y + 1.35, z + Math.sin(angle) * 2.2, 0.28, 0.55, 0.28, 'metal-dourado')
  }
  b.lights.push({ x, y: y + 3.4, z, color: '#8fe3ff', intensity: 8, distance: 22 })
  b.spots.portal = { x, z, y }
  b.spots.chests.push({ x: x + 5, z: z + 5, y: terrain.heightAt(x + 5, z + 5), tier: 1 })
  const group = b.build()
  group.name = 'Santuário'
  return { group, colliders: b.colliders, spots: b.spots }
}

export function buildTower(terrain: Terrain, x: number, z: number, seed: number): SiteResult {
  const y = terrain.heightAt(x, z)
  const b = new StructureBuilder(x, z, y, paletteForBiome(terrain.biomeAt(x, z, y)))
  const rng = mulberry32(seed)
  tower(b, x, z, y, 22, 5)
  b.box(x, y + 2.2, z + 5.2, 2.4, 3.2, 0.6, 'madeira-envelhecida')
  b.box(x, y + 0.22, z + 6.6, 3.4, 0.44, 3.2, 'pedra')
  stairs(b, x, z + 8.1, y, 3.2, 4, -0.72, 0.12)
  b.box(x, y + 4.8, z + 5.28, 0.18, 1.2, 0.1, 'brilho-azul')
  b.spots.chests.push({ x, z: z + 6.4, y, tier: 2 + Math.floor(rng() * 3) })
  b.spots.enemies.push({ x: x + 4, z: z + 4, y: terrain.heightAt(x + 4, z + 4) })
  b.spots.enemies.push({ x: x - 4, z: z + 2, y: terrain.heightAt(x - 4, z + 2) })
  b.spots.resources.push({ x: x - 7, z: z - 6, y: terrain.heightAt(x - 7, z - 6), kind: 'mithril' })
  b.spots.portal = { x: x + 2, z: z + 8, y: terrain.heightAt(x + 2, z + 8) }
  const group = b.build()
  group.name = 'Torre em Ruínas'
  return { group, colliders: b.colliders, spots: b.spots }
}

export function buildPort(terrain: Terrain, x: number, z: number, seed: number, houseModels: readonly (THREE.Object3D | null)[] = []): SiteResult {
  const y = terrain.heightAt(x, z)
  const b = new StructureBuilder(x, z, y, paletteForBiome(terrain.biomeAt(x, z, y)))
  const rng = mulberry32(seed)
  for (let i = 0; i < 5; i += 1) {
    b.box(x - 8 + i * 4, y + 0.5, z + 8, 3.6, 0.4, 10, 'madeira', 0, true, true)
    b.cylinder(x - 8 + i * 4, y + 0.2, z + 13, 0.25, 3, 'madeira')
    b.box(x - 8 + i * 4, y + 0.73, z + 8, 3.25, 0.08, 9.7, 'madeira-clara')
  }
  // A small moored skiff gives the dock a readable purpose without importing a new asset.
  b.box(x - 13, y + 0.44, z + 16, 3.1, 0.65, 6.2, 'madeira-envelhecida')
  b.cone(x - 13, y + 0.54, z + 19.2, 1.65, 2.1, 'madeira-envelhecida', 5)
  b.beam(x - 13, y + 0.78, z + 13.4, x - 13, y + 4.7, z + 13.4, 0.1, 'madeira')
  b.box(x - 13, y + 2.8, z + 13.35, 2.6, 3.3, 0.1, 'tecido-azul')
  b.beam(x - 13, y + 0.7, z + 16, x - 13, y + 0.7, z + 19, 0.06, 'metal-dourado')
  house(b, x + 10, z - 2, y, 10, 8, 4.1, rng, 'telhado', houseModels, 'cottage', terrain)
  b.beam(x + 1, y + 0.65, z + 6, x + 3, y + 0.65, z + 6, 0.08, 'madeira-clara')
  b.box(x + 2, y + 1.05, z + 6, 2, 0.8, 0.65, 'metal-dourado')
  b.spots.npcs.push({ x: x + 6, z: z + 2, y: terrain.heightAt(x + 6, z + 2) })
  b.spots.npcs.push({ x: x - 6, z: z + 6, y: terrain.heightAt(x - 6, z + 6) })
  b.spots.resources.push({ x: x - 2, z: z + 12, y: terrain.heightAt(x - 2, z + 12), kind: 'pesca' })
  b.spots.resources.push({ x: x + 4, z: z + 12, y: terrain.heightAt(x + 4, z + 12), kind: 'pesca' })
  b.spots.chests.push({ x: x + 14, z: z + 2, y: terrain.heightAt(x + 14, z + 2), tier: 2 })
  b.spots.portal = { x: x + 2, z: z - 6, y: terrain.heightAt(x + 2, z - 6) }
  for (let i = 0; i < 3; i += 1) {
    const ex = x - 14 + rng() * 8
    const ez = z - 8 + rng() * 6
    b.spots.enemies.push({ x: ex, z: ez, y: terrain.heightAt(ex, ez) })
  }
  const group = b.build()
  group.name = 'Porto'
  return { group, colliders: b.colliders, spots: b.spots }
}

export function buildCave(terrain: Terrain, x: number, z: number, seed: number): SiteResult {
  const y = terrain.heightAt(x, z)
  const b = new StructureBuilder(x, z, y, paletteForBiome(terrain.biomeAt(x, z, y)))
  const rng = mulberry32(seed)
  for (let i = 0; i < 9; i += 1) {
    const angle = Math.PI + (i / 8) * Math.PI
    const px = x + Math.cos(angle) * 7
    const pz = z + Math.sin(angle) * 7
    const h = 5.6 + rng() * 1.8
    const r = 1.1 + rng() * 0.45
    b.cylinder(px, y + h / 2, pz, r, h, 'pedra-escura', 6, true)
    b.cone(px, y + h + 0.25, pz, r * 1.25, 0.5, 'pedra', 6)
  }
  b.beam(x - 7, y + 6.2, z - 0.2, x + 7, y + 6.2, z - 0.2, 0.48, 'pedra-escura', 6)
  b.cone(x - 3.5, y + 5.8, z - 3.5, 1.1, 2.5, 'pedra-obsidiana', 6)
  b.cone(x + 2.8, y + 5.3, z - 4, 0.9, 2, 'pedra-obsidiana', 6)
  b.floor(x, y + 0.1, z, 16, 16, 'pedra-escura')
  for (let i = 0; i < 3; i += 1) brazier(b, x - 4 + i * 4, z - 4, y)
  b.spots.resources.push({ x: x + 3, z: z - 3, y, kind: 'ferro' })
  b.spots.resources.push({ x: x - 4, z: z - 2, y, kind: 'cristal' })
  b.spots.chests.push({ x: x + 5, z: z - 6, y, tier: 2 })
  for (let i = 0; i < 3; i += 1) {
    const ex = x + (rng() - 0.5) * 10
    const ez = z - 6 + (rng() - 0.5) * 6
    b.spots.enemies.push({ x: ex, z: ez, y: terrain.heightAt(ex, ez) })
  }
  const group = b.build()
  group.name = 'Caverna'
  return { group, colliders: b.colliders, spots: b.spots }
}

export function buildIslandSite(terrain: Terrain, x: number, z: number, seed: number): SiteResult {
  const y = terrain.heightAt(x, z)
  const b = new StructureBuilder(x, z, y, paletteForBiome(terrain.biomeAt(x, z, y)))
  const rng = mulberry32(seed)
  b.floor(x, y + 0.15, z, 18, 18, 'pedra')
  b.cylinder(x, y + 0.45, z, 7.8, 0.28, 'pedra-escura', 12)
  b.cylinder(x, y + 0.62, z, 6.2, 0.16, 'metal-dourado', 12)
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2
    const px = x + Math.cos(angle) * 5
    const pz = z + Math.sin(angle) * 5
    b.cylinder(px, y + 2, pz, 0.7, 4, 'pedra', 8, true)
    b.cylinder(px, y + 0.65, pz, 1, 0.5, 'pedra-escura', 8)
    b.box(px, y + 4.15, pz, 1.1, 0.35, 1.1, 'metal-dourado')
  }
  b.box(x, y + 1.2, z, 1.6, 2.4, 1.6, 'pedra-escura')
  b.cylinder(x, y + 0.86, z, 2.6, 0.35, 'pedra-escura', 10)
  b.cone(x, y + 3.2, z, 0.8, 1.4, 'brilho', 6)
  b.lights.push({ x, y: y + 3.4, z, color: '#b98cff', intensity: 9, distance: 24 })
  b.spots.chests.push({ x: x + 2, z: z + 2, y, tier: 5 })
  b.spots.boss = { x, z: z - 3, y }
  b.spots.portal = { x: x - 6, z: z + 6, y: terrain.heightAt(x - 6, z + 6) }
  for (let i = 0; i < 4; i += 1) {
    const ex = x + (rng() - 0.5) * 14
    const ez = z + (rng() - 0.5) * 14
    b.spots.enemies.push({ x: ex, z: ez, y: terrain.heightAt(ex, ez) })
  }
  const group = b.build()
  group.name = 'Ilha Secreta'
  return { group, colliders: b.colliders, spots: b.spots }
}
