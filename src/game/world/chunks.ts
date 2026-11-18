import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { hash2, mulberry32 } from '../core/rng'
import { clamp } from '../core/math'
import { BIOMES } from './biomes'
import type { Collider } from './collision'
import { grassGeometry, propMaterial, rockGeometry, treeGeometry } from './props'
import { SEA_LEVEL, type Terrain } from './terrain'

export const CHUNK_SIZE = 80
const NEAR_SEGMENTS = 20
const FAR_SEGMENTS = 10

export type Lod = 'near' | 'far'

const terrainMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 })
const propsMaterial = propMaterial()
const animalLoader = new GLTFLoader()
const animalAssets = [
  'https://gobkit.com/freebies/animal006/Doe.glb',
  'https://gobkit.com/freebies/animal006/Fox.glb',
  'https://gobkit.com/freebies/animal006/Hare.glb',
  'https://gobkit.com/freebies/animal006/Squirrel.glb',
  'https://gobkit.com/freebies/animal012/WildBoar.glb',
  'https://gobkit.com/freebies/animal012/PalominoHorse.glb',
  'https://gobkit.com/freebies/animalB/Goat.glb',
  'https://gobkit.com/freebies/animal005/Sheep.glb',
]
const animalCache = new Map<string, Promise<THREE.Group>>()
function loadAnimal(url: string): Promise<THREE.Group> {
  let pending = animalCache.get(url)
  if (!pending) {
    pending = animalLoader.loadAsync(url).then(gltf => gltf.scene)
    animalCache.set(url, pending)
    pending.catch(() => animalCache.delete(url))
  }
  return pending
}

export class Chunk {
  readonly group = new THREE.Group()
  readonly colliders: Collider[] = []
  private terrain?: THREE.Mesh
  private propGroup?: THREE.Group
  private currentLod?: Lod

  constructor(readonly cx: number, readonly cz: number, private readonly terrainField: Terrain, private readonly blocked: (x: number, z: number) => boolean) {
    this.group.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE)
    this.group.matrixAutoUpdate = false
    this.group.updateMatrix()
  }

  get key(): string {
    return `${this.cx},${this.cz}`
  }

  get lod(): Lod | undefined {
    return this.currentLod
  }

  build(lod: Lod): void {
    this.currentLod = lod
    this.buildTerrain(lod)
    this.buildProps(lod)
  }

  private buildTerrain(lod: Lod): void {
    if (this.terrain) {
      this.group.remove(this.terrain)
      this.terrain.geometry.dispose()
    }
    const segments = lod === 'near' ? NEAR_SEGMENTS : FAR_SEGMENTS
    const step = CHUNK_SIZE / segments
    const originX = this.cx * CHUNK_SIZE
    const originZ = this.cz * CHUNK_SIZE
    const count = segments + 1
    // Height grid with a one-cell border so slopes are correct at chunk edges.
    const grid: number[] = []
    for (let j = -1; j <= count; j += 1) {
      for (let i = -1; i <= count; i += 1) {
        grid.push(this.terrainField.heightAt(originX + i * step, originZ + j * step))
      }
    }
    const gridAt = (i: number, j: number): number => grid[(j + 1) * (count + 2) + (i + 1)]

    const positions = new Float32Array(count * count * 3)
    const colors = new Float32Array(count * count * 3)
    const color = new THREE.Color()
    for (let j = 0; j < count; j += 1) {
      for (let i = 0; i < count; i += 1) {
        const index = j * count + i
        const x = i * step
        const z = j * step
        const height = gridAt(i, j)
        positions[index * 3] = x
        positions[index * 3 + 1] = height
        positions[index * 3 + 2] = z
        const dx = (gridAt(i + 1, j) - gridAt(i - 1, j)) / (2 * step)
        const dz = (gridAt(i, j + 1) - gridAt(i, j - 1)) / (2 * step)
        const slope = Math.hypot(dx, dz)
        const biome = this.terrainField.biomeFrom(originX + x, originZ + z, height, slope)
        this.terrainField.vertexColor(originX + x, originZ + z, height, slope, biome, color)
        colors[index * 3] = color.r
        colors[index * 3 + 1] = color.g
        colors[index * 3 + 2] = color.b
      }
    }
    const indices: number[] = []
    for (let j = 0; j < segments; j += 1) {
      for (let i = 0; i < segments; i += 1) {
        const a = j * count + i
        const b = a + 1
        const c = a + count
        const d = c + 1
        indices.push(a, c, b, b, c, d)
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
    const mesh = new THREE.Mesh(geometry, terrainMaterial)
    mesh.receiveShadow = false
    mesh.castShadow = false
    mesh.matrixAutoUpdate = false
    mesh.updateMatrix()
    this.terrain = mesh
    this.group.add(mesh)
  }

  private buildProps(lod: Lod): void {
    if (this.propGroup) {
      this.group.remove(this.propGroup)
      this.propGroup.traverse(obj => {
        if ((obj as THREE.InstancedMesh).isInstancedMesh) (obj as THREE.InstancedMesh).dispose()
      })
      this.propGroup = undefined
    }
    this.colliders.length = 0
    if (lod === 'far') return

    const originX = this.cx * CHUNK_SIZE
    const originZ = this.cz * CHUNK_SIZE
    const centerX = originX + CHUNK_SIZE / 2
    const centerZ = originZ + CHUNK_SIZE / 2
    const centerHeight = this.terrainField.heightAt(centerX, centerZ)
    if (centerHeight < SEA_LEVEL - 0.5) return
    const biome = BIOMES[this.terrainField.biomeAt(centerX, centerZ, centerHeight)]
    const random = mulberry32((hash2(this.cx, this.cz, this.terrainField.seed + 17) * 4294967296) >>> 0)
    const group = new THREE.Group()

    const treeKind = biome.treeKind
    const treeGeo = treeKind === 'nenhum' ? null : treeGeometry(treeKind)
    if (treeGeo) {
      const wanted = Math.round(biome.treeDensity * (0.7 + random() * 0.6))
      const matrix = new THREE.Matrix4()
      const quaternion = new THREE.Quaternion()
      const position = new THREE.Vector3()
      const scale = new THREE.Vector3()
      const placed: { x: number; z: number; y: number; s: number }[] = []
      for (let attempt = 0; attempt < wanted * 4 && placed.length < wanted; attempt += 1) {
        const x = originX + random() * CHUNK_SIZE
        const z = originZ + random() * CHUNK_SIZE
        const y = this.terrainField.heightAt(x, z)
        if (y < SEA_LEVEL + 1.4) continue
        if (this.terrainField.slopeAt(x, z) > 0.8) continue
        if (this.blocked(x, z)) continue
        if (placed.some(p => Math.hypot(p.x - x, p.z - z) < 4.2)) continue
        const s = 0.75 + random() * 0.7
        placed.push({ x, z, y, s })
      }
      if (placed.length) {
        const mesh = new THREE.InstancedMesh(treeGeo, propsMaterial, placed.length)
        placed.forEach((p, index) => {
          position.set(p.x - originX, p.y - 0.15, p.z - originZ)
          quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), random() * Math.PI * 2)
          scale.set(p.s, p.s * (0.85 + random() * 0.35), p.s)
          matrix.compose(position, quaternion, scale)
          mesh.setMatrixAt(index, matrix)
          if (p.s > 0.85) this.colliders.push({ kind: 'circle', x: p.x, z: p.z, radius: 0.42 * p.s })
        })
        mesh.castShadow = true
        mesh.receiveShadow = false
        mesh.computeBoundingSphere()
        group.add(mesh)
      }
    }

    const rockCount = Math.round(biome.rockDensity * (0.6 + random() * 0.9))
    if (rockCount > 0) {
      const variants = [rockGeometry(0), rockGeometry(1), rockGeometry(2)]
      const buckets: THREE.Matrix4[][] = [[], [], []]
      const matrix = new THREE.Matrix4()
      const quaternion = new THREE.Quaternion()
      const position = new THREE.Vector3()
      const scale = new THREE.Vector3()
      for (let i = 0; i < rockCount; i += 1) {
        const x = originX + random() * CHUNK_SIZE
        const z = originZ + random() * CHUNK_SIZE
        const y = this.terrainField.heightAt(x, z)
        if (y < SEA_LEVEL - 1) continue
        if (this.blocked(x, z)) continue
        const s = 0.5 + random() * 2.6
        position.set(x - originX, y - s * 0.25, z - originZ)
        quaternion.setFromEuler(new THREE.Euler(random() * 0.4, random() * Math.PI * 2, random() * 0.4))
        scale.set(s, s * (0.6 + random() * 0.6), s)
        matrix.compose(position, quaternion, scale)
        buckets[i % 3].push(matrix.clone())
        if (s > 1.1) this.colliders.push({ kind: 'circle', x, z, radius: s * 0.72, top: y + s * 0.5 })
      }
      buckets.forEach((list, index) => {
        if (!list.length) return
        const mesh = new THREE.InstancedMesh(variants[index], propsMaterial, list.length)
        list.forEach((m, i) => mesh.setMatrixAt(i, m))
        mesh.castShadow = true
        mesh.receiveShadow = false
        mesh.computeBoundingSphere()
        group.add(mesh)
      })
    }

    if (biome.grassDensity > 0) {
      const grassCount = Math.round(biome.grassDensity * (0.7 + random() * 0.6))
      const matrix = new THREE.Matrix4()
      const quaternion = new THREE.Quaternion()
      const position = new THREE.Vector3()
      const scale = new THREE.Vector3()
      const mesh = new THREE.InstancedMesh(grassGeometry(), propsMaterial, grassCount)
      let filled = 0
      for (let i = 0; i < grassCount; i += 1) {
        const x = originX + random() * CHUNK_SIZE
        const z = originZ + random() * CHUNK_SIZE
        const y = this.terrainField.heightAt(x, z)
        if (y < SEA_LEVEL + 1.2) continue
        if (this.blocked(x, z)) continue
        position.set(x - originX, y, z - originZ)
        quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), random() * Math.PI)
        const s = 0.7 + random() * 0.9
        scale.set(s, s * (0.8 + random() * 0.7), s)
        matrix.compose(position, quaternion, scale)
        mesh.setMatrixAt(filled, matrix)
        filled += 1
      }
      mesh.count = filled
      mesh.receiveShadow = false
      mesh.computeBoundingSphere()
      group.add(mesh)
    }

    this.populateWildlife(group, originX, originZ, random, centerHeight)
    this.propGroup = group
    this.group.add(group)
  }

  private populateWildlife(group: THREE.Group, originX: number, originZ: number, random: () => number, centerHeight: number): void {
    if (centerHeight < SEA_LEVEL + 2) return
    const count = 1 + Math.floor(random() * 2)
    for (let i = 0; i < count; i += 1) {
      const x = originX + 8 + random() * (CHUNK_SIZE - 16)
      const z = originZ + 8 + random() * (CHUNK_SIZE - 16)
      const y = this.terrainField.heightAt(x, z)
      if (y < SEA_LEVEL + 2 || this.terrainField.slopeAt(x, z) > 0.65 || this.blocked(x, z)) continue
      const biome = this.terrainField.biomeAt(x, z, y)
      if (biome === 'oceano' || biome === 'vulcanico' || biome === 'cinzas') continue
      const options = biome === 'deserto' ? [animalAssets[2], animalAssets[3], animalAssets[1]]
        : biome === 'neve' || biome === 'montanha' ? [animalAssets[0], animalAssets[1], animalAssets[5]]
        : biome === 'praia' || biome === 'ilha' ? [animalAssets[3], animalAssets[6], animalAssets[2]]
        : animalAssets
      const url = options[Math.floor(random() * options.length)]
      void loadAnimal(url).then(source => {
        if (!group.parent) return
        const animal = clone(source) as THREE.Group
        const bounds = new THREE.Box3().setFromObject(animal)
        const size = bounds.getSize(new THREE.Vector3())
        const scale = (url.includes('PalominoHorse') ? 1.65 : 0.95) / Math.max(0.01, size.y)
        animal.scale.setScalar(scale)
        const scaled = new THREE.Box3().setFromObject(animal)
        animal.position.set(x - originX, y - scaled.min.y, z - originZ)
        animal.rotation.y = random() * Math.PI * 2
        animal.traverse(object => {
          const mesh = object as THREE.Mesh
          if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = false }
        })
        group.add(animal)
      }).catch(() => undefined)
    }
  }

  dispose(): void {
    this.terrain?.geometry.dispose()
    this.propGroup?.traverse(obj => {
      if ((obj as THREE.InstancedMesh).isInstancedMesh) (obj as THREE.InstancedMesh).dispose()
    })
    this.group.clear()
    this.colliders.length = 0
  }
}

/** Streams chunks around the player, keeping a fixed budget of builds per frame. */
export class ChunkManager {
  private readonly chunks = new Map<string, Chunk>()
  readonly group = new THREE.Group()

  constructor(private readonly terrainField: Terrain, private readonly blocked: (x: number, z: number) => boolean, private readonly viewRadius: number) {}

  get loaded(): number {
    return this.chunks.size
  }

  chunkAt(x: number, z: number): Chunk | undefined {
    return this.chunks.get(`${Math.floor(x / CHUNK_SIZE)},${Math.floor(z / CHUNK_SIZE)}`)
  }

  /** Colliders from the chunks touching a world position (3x3 neighbourhood). */
  collidersNear(x: number, z: number, out: Collider[]): Collider[] {
    out.length = 0
    const cx = Math.floor(x / CHUNK_SIZE)
    const cz = Math.floor(z / CHUNK_SIZE)
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const chunk = this.chunks.get(`${cx + dx},${cz + dz}`)
        if (chunk) out.push(...chunk.colliders)
      }
    }
    return out
  }

  /** Returns true when a chunk finished building this frame. */
  update(px: number, pz: number, maxBuilds = 1): boolean {
    const pcx = Math.floor(px / CHUNK_SIZE)
    const pcz = Math.floor(pz / CHUNK_SIZE)
    const radius = this.viewRadius
    let built = false
    // Unload chunks outside the radius (plus one row of hysteresis).
    for (const [key, chunk] of this.chunks) {
      if (Math.abs(chunk.cx - pcx) > radius + 1 || Math.abs(chunk.cz - pcz) > radius + 1) {
        this.group.remove(chunk.group)
        chunk.dispose()
        this.chunks.delete(key)
      }
    }
    // Load nearest missing chunks first.
    const missing: { cx: number; cz: number; d: number }[] = []
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const cx = pcx + dx
        const cz = pcz + dz
        if (dx * dx + dz * dz > radius * radius + radius) continue
        const key = `${cx},${cz}`
        const existing = this.chunks.get(key)
        const lod: Lod = dx * dx + dz * dz <= 9 ? 'near' : 'far'
        if (existing) {
          if (lod === 'near' && existing.lod === 'far') existing.build('near')
          continue
        }
        missing.push({ cx, cz, d: dx * dx + dz * dz })
      }
    }
    missing.sort((a, b) => a.d - b.d)
    for (const item of missing.slice(0, maxBuilds)) {
      const chunk = new Chunk(item.cx, item.cz, this.terrainField, this.blocked)
      chunk.build(item.d <= 9 ? 'near' : 'far')
      this.chunks.set(chunk.key, chunk)
      this.group.add(chunk.group)
      built = true
    }
    return built
  }

  /** Synchronously load the chunks around a teleport target so the ground exists immediately. */
  prime(px: number, pz: number, radius = 2): void {
    const pcx = Math.floor(px / CHUNK_SIZE)
    const pcz = Math.floor(pz / CHUNK_SIZE)
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const key = `${pcx + dx},${pcz + dz}`
        if (this.chunks.has(key)) continue
        const chunk = new Chunk(pcx + dx, pcz + dz, this.terrainField, this.blocked)
        chunk.build('near')
        this.chunks.set(key, chunk)
        this.group.add(chunk.group)
      }
    }
  }

  dispose(): void {
    for (const chunk of this.chunks.values()) {
      this.group.remove(chunk.group)
      chunk.dispose()
    }
    this.chunks.clear()
  }
}

/** Visual distance fog tuned per quality preset. */
export function fogForQuality(quality: 'low' | 'medium' | 'high'): number {
  return clamp(quality === 'low' ? 240 : quality === 'medium' ? 330 : 430, 120, 600)
}
