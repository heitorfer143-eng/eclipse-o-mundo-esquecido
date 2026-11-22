import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { hash2, mulberry32 } from '../core/rng'
import { clamp } from '../core/math'
import { BIOMES } from './biomes'
import type { BiomeId } from '../data/types'
import type { Collider } from './collision'
import { grassGeometry, propMaterial, rockGeometry, treeGeometries } from './props'
import { addInstancedTreeModels } from './treeModels'
import { SEA_LEVEL, type Terrain } from './terrain'

export const CHUNK_SIZE = 80
const NEAR_SEGMENTS = 20
const FAR_SEGMENTS = 10

export type Lod = 'near' | 'far'

const terrainMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 })
const rockMaterial = propMaterial()
const grassMaterial = propMaterial()
const treeBarkMaterial = propMaterial()
const treeFoliageMaterial = propMaterial()
const treeNatureLeavesMaterial = new THREE.MeshStandardMaterial({
  color: '#ffffff', roughness: 0.98, metalness: 0, side: THREE.DoubleSide, alphaTest: 0.36,
})
const animalLoader = new GLTFLoader()
export type AnimalMotion = 'idle' | 'walk' | 'run'
type AnimalAction = AnimalMotion | 'death'
type AnimalBone = { bone: THREE.Bone; base: THREE.Euler; phase: number; amplitude: number }
export type WildlifeKind = 'alpaca' | 'touro' | 'vaca' | 'cervo' | 'burro' | 'raposa' | 'cavalo' | 'cavalo-branco' | 'husky' | 'shiba-inu' | 'cervo-real' | 'lobo'
type AnimalAsset = {
  file: string
  url: string
  id: WildlifeKind
  name: string
  rare?: boolean
  mountable?: boolean
  health: number
  radius: number
  height: number
  targetHeight: number
}
const animalDefinitions: Omit<AnimalAsset, 'url'>[] = [
  { file: 'Alpaca', id: 'alpaca', name: 'Alpaca', health: 38, radius: 0.48, height: 1.12, targetHeight: 1.12 },
  { file: 'Bull', id: 'touro', name: 'Touro', health: 82, radius: 0.76, height: 1.5, targetHeight: 1.5 },
  { file: 'Cow', id: 'vaca', name: 'Vaca', health: 62, radius: 0.68, height: 1.32, targetHeight: 1.32 },
  { file: 'Deer', id: 'cervo', name: 'Cervo', health: 38, radius: 0.52, height: 1.25, targetHeight: 1.25 },
  { file: 'Donkey', id: 'burro', name: 'Burro', mountable: true, health: 52, radius: 0.58, height: 1.28, targetHeight: 1.28 },
  { file: 'Fox', id: 'raposa', name: 'Raposa', health: 24, radius: 0.38, height: 0.63, targetHeight: 0.63 },
  { file: 'Horse', id: 'cavalo', name: 'Cavalo selvagem', mountable: true, health: 72, radius: 0.72, height: 1.55, targetHeight: 1.55 },
  { file: 'Horse_White', id: 'cavalo-branco', name: 'Cavalo branco raro', rare: true, mountable: true, health: 72, radius: 0.72, height: 1.55, targetHeight: 1.55 },
  { file: 'Husky', id: 'husky', name: 'Husky', health: 34, radius: 0.42, height: 0.62, targetHeight: 0.62 },
  { file: 'ShibaInu', id: 'shiba-inu', name: 'Shiba Inu', health: 28, radius: 0.34, height: 0.5, targetHeight: 0.52 },
  { file: 'Stag', id: 'cervo-real', name: 'Cervo-real raro', rare: true, health: 50, radius: 0.64, height: 1.42, targetHeight: 1.42 },
  { file: 'Wolf', id: 'lobo', name: 'Lobo', health: 48, radius: 0.45, height: 0.72, targetHeight: 0.72 },
]
const animalAssets: AnimalAsset[] = animalDefinitions.map(species => ({
  ...species,
  url: `${import.meta.env.BASE_URL}assets/models/quaternius/animals/${species.file}.glb`,
}))

export function wildlifeOptionsForBiome(biome: BiomeId): readonly AnimalAsset[] {
  if (biome === 'deserto') return animalAssets.filter(asset => ['Alpaca', 'Donkey', 'Fox'].includes(asset.file))
  if (biome === 'neve' || biome === 'montanha') return animalAssets.filter(asset => ['Deer', 'Horse_White', 'Husky', 'Wolf', 'Stag'].includes(asset.file))
  if (biome === 'praia' || biome === 'ilha') return animalAssets.filter(asset => ['Alpaca', 'Donkey', 'ShibaInu', 'Fox'].includes(asset.file))
  if (biome === 'pantano') return animalAssets.filter(asset => ['Fox', 'Wolf', 'Deer'].includes(asset.file))
  if (biome === 'floresta' || biome === 'floresta-densa') return animalAssets.filter(asset => ['Deer', 'Fox', 'Stag', 'Wolf', 'Husky', 'ShibaInu'].includes(asset.file))
  return animalAssets
}

export function selectWildlifeForBiome(biome: BiomeId, rareRoll: number, speciesRoll: number): WildlifeKind {
  const options = wildlifeOptionsForBiome(biome)
  const rareOptions = options.filter(asset => asset.rare)
  const commonOptions = options.filter(asset => !asset.rare)
  const pool = rareOptions.length && rareRoll < 0.14 ? rareOptions : commonOptions.length ? commonOptions : options
  const index = Math.min(pool.length - 1, Math.floor(clamp(speciesRoll, 0, 0.999999) * pool.length))
  return pool[Math.max(0, index)].id
}

export function wildlifeCanBeMounted(kind: WildlifeKind): boolean {
  return animalAssets.find(asset => asset.id === kind)?.mountable === true
}
export type WildlifeAgent = {
  id: WildlifeKind
  name: string
  rare: boolean
  mountable: boolean
  mounted: boolean
  chunkOriginX: number
  chunkOriginZ: number
  root: THREE.Group
  model: THREE.Group
  mixer: THREE.AnimationMixer
  actions: Record<AnimalAction, THREE.AnimationAction | undefined>
  active?: THREE.AnimationAction
  position: THREE.Vector3
  worldPosition: THREE.Vector3
  target: THREE.Vector3
  direction: THREE.Vector3
  state: AnimalMotion
  timer: number
  phase: number
  baseModelY: number
  bones: AnimalBone[]
  health: number
  maxHealth: number
  radius: number
  height: number
  dead: boolean
  counted: boolean
  deathTimer: number
  respawnTimer: number
  takeDamage: (amount: number) => { amount: number; killed: boolean }
}

export type ChunkTextureSet = {
  grass: THREE.Texture; leaves: THREE.Texture; bark: THREE.Texture; stone: THREE.Texture; rock: THREE.Texture
  treeBark?: THREE.Texture; treeBarkNormal?: THREE.Texture; natureGrass?: THREE.Texture; natureLeaves?: THREE.Texture; natureRocks?: THREE.Texture
}

export function applyChunkTextures(textures: ChunkTextureSet): void {
  for (const texture of Object.values(textures)) {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.needsUpdate = true
  }
  terrainMaterial.map = textures.grass
  grassMaterial.map = textures.natureGrass ?? textures.grass
  grassMaterial.side = THREE.DoubleSide
  treeFoliageMaterial.map = textures.leaves
  treeBarkMaterial.map = textures.treeBark ?? textures.bark
  treeBarkMaterial.normalMap = textures.treeBarkNormal ?? null
  if (textures.treeBarkNormal) treeBarkMaterial.normalScale.set(0.55, 0.55)
  rockMaterial.map = textures.natureRocks ?? textures.rock
  rockMaterial.bumpMap = textures.natureRocks ?? null
  rockMaterial.bumpScale = 0.12
  treeNatureLeavesMaterial.map = textures.natureLeaves ?? null
  if (textures.natureRocks) textures.natureRocks.repeat.set(1, 1)
  terrainMaterial.needsUpdate = true
  grassMaterial.needsUpdate = true
  treeFoliageMaterial.needsUpdate = true
  treeBarkMaterial.needsUpdate = true
  treeNatureLeavesMaterial.needsUpdate = true
  rockMaterial.needsUpdate = true
}

function wildlifeKind(url: string): Omit<AnimalAsset, 'file' | 'url' | 'targetHeight'> {
  const species = animalAssets.find(asset => asset.url === url)
  if (!species) throw new Error(`Espécie de fauna não registrada: ${url}`)
  const { id, name, rare, mountable, health, radius, height } = species
  return { id, name, rare, mountable, health, radius, height }
}

function makeRareWildlifeMarker(): THREE.Mesh {
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.68, 0.82, 24),
    new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.88, side: THREE.DoubleSide, depthWrite: false }),
  )
  marker.name = 'rare-wildlife-marker'
  marker.rotation.x = -Math.PI / 2
  marker.position.y = 0.035
  marker.renderOrder = 4
  return marker
}

const animalCache = new Map<string, Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>>()
function loadAnimal(url: string): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> {
  let pending = animalCache.get(url)
  if (!pending) {
    pending = animalLoader.loadAsync(url).then(gltf => {
      // Initialize skinned bounds before SkeletonUtils.clone rebinds the animal skeleton.
      new THREE.Box3().setFromObject(gltf.scene)
      return { scene: gltf.scene, animations: gltf.animations.map(stripAnimalRootMotion) }
    })
    animalCache.set(url, pending)
    pending.catch(() => animalCache.delete(url))
  }
  return pending
}

export function resolveAnimalClipName(mode: AnimalAction, names: readonly string[]): string | undefined {
  const candidates = mode === 'idle' ? ['idle', 'stand', 'rest']
    : mode === 'walk' ? ['walk', 'walking', 'trot', 'move']
      : mode === 'run' ? ['run', 'running', 'gallop', 'canter', 'walk', 'walking']
        : ['death', 'dead', 'die']
  const normalized = names.map(name => name.toLowerCase())
  for (const candidate of candidates) {
    const exact = normalized.findIndex(name => name === candidate)
    if (exact >= 0) return names[exact]
  }
  for (const candidate of candidates) {
    const partial = normalized.findIndex(name => name.includes(candidate))
    if (partial >= 0) return names[partial]
  }
  return undefined
}

function stripAnimalRootMotion(source: THREE.AnimationClip): THREE.AnimationClip {
  const clip = source.clone()
  clip.tracks = clip.tracks.filter(track => {
    const split = track.name.lastIndexOf('.')
    if (split < 0 || track.name.slice(split + 1) !== 'position') return true
    const node = track.name.slice(0, split).split(/[/.|:]/).at(-1)?.toLowerCase()
    return node !== 'root' && node !== 'hips' && node !== 'armature'
  })
  clip.resetDuration()
  return clip
}

function collectAnimalBones(model: THREE.Group): AnimalBone[] {
  const bones: AnimalBone[] = []
  model.traverse(object => {
    const bone = object as THREE.Bone
    if (!bone.isBone) return
    const name = bone.name.toLowerCase().replace(/[^a-z]/g, '')
    if (!/leg|paw|foot|hoof|hock|arm/.test(name)) return
    const left = /left/.test(name) || /(^|[^a-z])l($|[^a-z])/.test(bone.name.toLowerCase())
    const arm = /arm/.test(name)
    bones.push({ bone, base: bone.rotation.clone(), phase: (left ? 0 : Math.PI) + (arm ? Math.PI : 0), amplitude: arm ? 0.2 : 0.38 })
  })
  return bones
}

export class Chunk {
  readonly group = new THREE.Group()
  readonly colliders: Collider[] = []
  private readonly wildlife: WildlifeAgent[] = []
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

  wildlifeAgents(): WildlifeAgent[] {
    return this.wildlife
  }

  detachWildlife(agent: WildlifeAgent): void {
    const index = this.wildlife.indexOf(agent)
    if (index >= 0) this.wildlife.splice(index, 1)
  }

  adoptWildlife(agent: WildlifeAgent): void {
    if (!this.wildlife.includes(agent)) this.wildlife.push(agent)
    this.group.add(agent.root)
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
    const uvs = new Float32Array(count * count * 2)
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
        uvs[index * 2] = (originX + x) * 0.06
        uvs[index * 2 + 1] = (originZ + z) * 0.06
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
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
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
    this.disposeWildlife()
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
    const treeGeo = treeKind === 'nenhum' ? null : treeGeometries(treeKind)
    if (treeGeo) {
      const wanted = Math.round(biome.treeDensity * (0.7 + random() * 0.6))
      const matrix = new THREE.Matrix4()
      const quaternion = new THREE.Quaternion()
      const position = new THREE.Vector3()
      const scale = new THREE.Vector3()
      const placed: { x: number; z: number; y: number; s: number; variantRoll: number }[] = []
      for (let attempt = 0; attempt < wanted * 4 && placed.length < wanted; attempt += 1) {
        const x = originX + random() * CHUNK_SIZE
        const z = originZ + random() * CHUNK_SIZE
        const y = this.terrainField.heightAt(x, z)
        if (y < SEA_LEVEL + 1.4) continue
        if (this.terrainField.slopeAt(x, z) > 0.8) continue
        if (this.blocked(x, z)) continue
        if (placed.some(p => Math.hypot(p.x - x, p.z - z) < 4.2)) continue
        const s = 0.75 + random() * 0.7
        placed.push({ x, z, y, s, variantRoll: random() })
      }
      if (placed.length) {
        const barkMesh = treeGeo.bark ? new THREE.InstancedMesh(treeGeo.bark, treeBarkMaterial, placed.length) : null
        const foliageMesh = treeGeo.foliage ? new THREE.InstancedMesh(treeGeo.foliage, treeFoliageMaterial, placed.length) : null
        const natureLeavesMesh = treeGeo.natureLeaves && treeNatureLeavesMaterial.map
          ? new THREE.InstancedMesh(treeGeo.natureLeaves, treeNatureLeavesMaterial, placed.length) : null
        if (barkMesh) barkMesh.name = 'world-tree-bark'
        if (foliageMesh) foliageMesh.name = 'world-tree-foliage'
        if (natureLeavesMesh) natureLeavesMesh.name = 'world-nature-leaves'
        placed.forEach((p, index) => {
          position.set(p.x - originX, p.y - 0.15, p.z - originZ)
          quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), random() * Math.PI * 2)
          scale.set(p.s, p.s * (0.85 + random() * 0.35), p.s)
          matrix.compose(position, quaternion, scale)
          barkMesh?.setMatrixAt(index, matrix)
          foliageMesh?.setMatrixAt(index, matrix)
          natureLeavesMesh?.setMatrixAt(index, matrix)
          if (p.s > 0.85) this.colliders.push({ kind: 'circle', x: p.x, z: p.z, radius: 0.42 * p.s })
        })
        addInstancedTreeModels(group, treeKind, placed.map(p => ({ ...p, x: p.x - originX, z: p.z - originZ })))
        for (const mesh of [barkMesh, foliageMesh, natureLeavesMesh]) {
          if (!mesh) continue
          mesh.castShadow = true
          mesh.receiveShadow = false
          mesh.computeBoundingSphere()
          group.add(mesh)
        }
      }
    }

    const rockCount = Math.round(biome.rockDensity * (1.6 + random() * 1.2))
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
        const mesh = new THREE.InstancedMesh(variants[index], rockMaterial, list.length)
        mesh.name = 'world-rocks'
        list.forEach((m, i) => mesh.setMatrixAt(i, m))
        mesh.castShadow = true
        mesh.receiveShadow = false
        mesh.computeBoundingSphere()
        group.add(mesh)
      })
    }

    if (biome.grassDensity > 0) {
      const grassCount = Math.round(biome.grassDensity * (2 + random() * 0.8))
      const matrix = new THREE.Matrix4()
      const quaternion = new THREE.Quaternion()
      const position = new THREE.Vector3()
      const scale = new THREE.Vector3()
      const mesh = new THREE.InstancedMesh(grassGeometry(), grassMaterial, grassCount)
      mesh.name = 'world-grass'
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
    const count = 2 + Math.floor(random() * 2)
    for (let i = 0; i < count; i += 1) {
      const x = originX + 8 + random() * (CHUNK_SIZE - 16)
      const z = originZ + 8 + random() * (CHUNK_SIZE - 16)
      const y = this.terrainField.heightAt(x, z)
      if (y < SEA_LEVEL + 2 || this.terrainField.slopeAt(x, z) > 0.65 || this.blocked(x, z)) continue
      const biome = this.terrainField.biomeAt(x, z, y)
      if (biome === 'oceano' || biome === 'vulcanico' || biome === 'cinzas') continue
      const options = wildlifeOptionsForBiome(biome)
      const rareRoll = options.some(asset => asset.rare) ? random() : 1
      const speciesRoll = random()
      const selected = animalAssets.find(asset => asset.id === selectWildlifeForBiome(biome, rareRoll, speciesRoll))!
      const url = selected.url
      const localX = x - originX
      const localZ = z - originZ
      const heading = random() * Math.PI * 2
      const target = new THREE.Vector3(8 + random() * (CHUNK_SIZE - 16), 0, 8 + random() * (CHUNK_SIZE - 16))
      const phase = random() * Math.PI * 2
      const timer = 1 + random() * 3
      const species = wildlifeKind(url)
      void loadAnimal(url).then(source => {
        if (!group.parent) return
        const animal = clone(source.scene) as THREE.Group
        const bounds = new THREE.Box3().setFromObject(animal)
        const size = bounds.getSize(new THREE.Vector3())
        const targetHeight = selected.targetHeight
        const scale = targetHeight / Math.max(0.01, size.y)
        animal.scale.setScalar(scale)
        const scaled = new THREE.Box3().setFromObject(animal)
        const baseModelY = -scaled.min.y
        animal.position.set(0, baseModelY, 0)
        animal.traverse(object => {
          const mesh = object as THREE.Mesh
          if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = false }
        })
        const root = new THREE.Group()
        root.position.set(localX, y, localZ)
        root.rotation.y = heading
        root.add(animal)
        group.add(root)
        if (species.rare) root.add(makeRareWildlifeMarker())
        const animations = source.animations
        const names = animations.map(clip => clip.name)
        const findClip = (name: string | undefined): THREE.AnimationClip | undefined => name ? animations.find(clip => clip.name === name) : undefined
        const idleClip = findClip(resolveAnimalClipName('idle', names))
        const walkClip = findClip(resolveAnimalClipName('walk', names))
        const runClip = findClip(resolveAnimalClipName('run', names)) ?? walkClip
        const deathClip = findClip(resolveAnimalClipName('death', names))
        const mixer = new THREE.AnimationMixer(animal)
        const makeAction = (clip?: THREE.AnimationClip): THREE.AnimationAction | undefined => {
          if (!clip) return undefined
          const action = mixer.clipAction(clip)
          action.setLoop(THREE.LoopRepeat, Infinity)
          action.clampWhenFinished = false
          return action
        }
        const agent: WildlifeAgent = {
          ...species,
          rare: Boolean(species.rare),
          mountable: Boolean(species.mountable),
          mounted: false,
          chunkOriginX: originX,
          chunkOriginZ: originZ,
          root,
          model: animal,
          mixer,
          actions: { idle: makeAction(idleClip), walk: makeAction(walkClip), run: makeAction(runClip), death: makeAction(deathClip) },
          position: new THREE.Vector3(localX, y, localZ),
          worldPosition: new THREE.Vector3(x, y, z),
          target,
          direction: new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading)),
          state: 'idle',
          timer,
          phase,
          baseModelY,
          bones: collectAnimalBones(animal),
          health: species.health,
          maxHealth: species.health,
          dead: false,
          counted: false,
          deathTimer: 0,
          respawnTimer: 0,
          takeDamage: amount => {
            if (agent.dead) return { amount: 0, killed: false }
            const dealt = Math.max(1, Math.round(amount))
            agent.health = Math.max(0, agent.health - dealt)
            const killed = agent.health <= 0
            if (killed) {
              agent.dead = true
              const death = agent.actions.death
              agent.deathTimer = death ? Math.max(0.85, death.getClip().duration) : 0.85
              agent.respawnTimer = 55
              agent.state = 'idle'
              agent.active?.fadeOut(0.1)
              if (death) {
                death.reset().fadeIn(0.08).setLoop(THREE.LoopOnce, 1)
                death.clampWhenFinished = true
                death.play()
                agent.active = death
              } else agent.active = undefined
            }
            return { amount: dealt, killed }
          },
        }
        this.wildlife.push(agent)
      }).catch(() => undefined)
    }
  }

  updateWildlife(dt: number, player: THREE.Vector3): void {
    const step = Math.max(0, Math.min(0.1, dt))
    if (step <= 0) return
    const originX = this.cx * CHUNK_SIZE
    const originZ = this.cz * CHUNK_SIZE
    for (const agent of this.wildlife) {
      if (agent.mounted) {
        agent.mixer.update(step)
        continue
      }
      if (agent.dead) {
        agent.deathTimer -= step
        if (agent.actions.death) agent.mixer.update(step)
        if (agent.deathTimer > 0) {
          if (!agent.actions.death) agent.root.rotation.z = Math.min(Math.PI / 2, (0.85 - agent.deathTimer) / 0.85 * (Math.PI / 2))
        } else {
          agent.root.visible = false
          agent.respawnTimer -= step
          if (agent.respawnTimer <= 0) {
            agent.dead = false
            agent.counted = false
            agent.health = agent.maxHealth
            agent.root.visible = true
            agent.root.rotation.z = 0
            agent.position.y = this.terrainField.heightAt(originX + agent.position.x, originZ + agent.position.z)
            agent.root.position.copy(agent.position)
            agent.state = 'idle'
            agent.timer = 2
          }
        }
        continue
      }
      const worldX = originX + agent.position.x
      const worldZ = originZ + agent.position.z
      const awayX = worldX - player.x
      const awayZ = worldZ - player.z
      const playerDistance = Math.hypot(awayX, awayZ)
      if (playerDistance < 9 && !(agent.mountable && playerDistance < 3.5)) {
        const length = Math.max(0.001, playerDistance)
        agent.direction.set(awayX / length, 0, awayZ / length)
        agent.target.set(
          Math.max(6, Math.min(CHUNK_SIZE - 6, agent.position.x + agent.direction.x * 18)),
          0,
          Math.max(6, Math.min(CHUNK_SIZE - 6, agent.position.z + agent.direction.z * 18)),
        )
        agent.state = 'run'
      } else {
        if (agent.state === 'run') {
          agent.state = 'idle'
          agent.timer = 1.2
        }
        agent.timer -= step
        if (agent.timer <= 0) {
          if (Math.random() < 0.62) {
            agent.state = 'walk'
            agent.target.set(7 + Math.random() * (CHUNK_SIZE - 14), 0, 7 + Math.random() * (CHUNK_SIZE - 14))
            agent.timer = 3 + Math.random() * 4
          } else {
            agent.state = 'idle'
            agent.timer = 1.5 + Math.random() * 3
          }
        }
      }

      if (agent.state === 'walk' || agent.state === 'run') {
        const dx = agent.target.x - agent.position.x
        const dz = agent.target.z - agent.position.z
        const distance = Math.hypot(dx, dz)
        if (distance < 0.8) {
          agent.state = 'idle'
          agent.timer = 1.2 + Math.random() * 1.8
        } else {
          const desiredX = dx / distance
          const desiredZ = dz / distance
          agent.direction.x += (desiredX - agent.direction.x) * Math.min(1, step * 4)
          agent.direction.z += (desiredZ - agent.direction.z) * Math.min(1, step * 4)
          agent.direction.normalize()
          const speed = agent.state === 'run' ? 4.4 : 1.05
          const nextX = Math.max(5, Math.min(CHUNK_SIZE - 5, agent.position.x + agent.direction.x * speed * step))
          const nextZ = Math.max(5, Math.min(CHUNK_SIZE - 5, agent.position.z + agent.direction.z * speed * step))
          const nextWorldX = originX + nextX
          const nextWorldZ = originZ + nextZ
          const nextY = this.terrainField.heightAt(nextWorldX, nextWorldZ)
          if (nextY < SEA_LEVEL + 1 || this.terrainField.slopeAt(nextWorldX, nextWorldZ) > 0.72 || this.blocked(nextWorldX, nextWorldZ)) {
            agent.state = 'idle'
            agent.timer = 1.3
          } else {
            agent.position.set(nextX, nextY, nextZ)
          }
        }
      }

      agent.root.position.copy(agent.position)
      agent.root.rotation.y = Math.atan2(agent.direction.x, agent.direction.z)
      agent.worldPosition.set(originX + agent.position.x, agent.position.y, originZ + agent.position.z)
      const movementAction = agent.state === 'run' ? agent.actions.run ?? agent.actions.walk
        : agent.state === 'walk' ? agent.actions.walk : agent.actions.idle
      const action = agent.state === 'idle' ? agent.actions.idle : movementAction ?? agent.actions.idle
      if (action && agent.active !== action) {
        agent.active?.fadeOut(0.22)
        action.reset().fadeIn(0.22)
        action.play()
        agent.active = action
      }
      agent.mixer.update(step)
      const hasLocomotion = Boolean(agent.actions.walk || agent.actions.run)
      if ((agent.state === 'walk' || agent.state === 'run') && !hasLocomotion) {
        agent.phase += step * (agent.state === 'run' ? 11 : 7)
        agent.model.position.y = agent.baseModelY + Math.abs(Math.sin(agent.phase * 2)) * 0.035
        for (const item of agent.bones) {
          item.bone.rotation.set(item.base.x + Math.sin(agent.phase + item.phase) * item.amplitude, item.base.y, item.base.z)
        }
      } else if (!hasLocomotion && !agent.actions.idle) {
        agent.model.position.y = agent.baseModelY
        for (const item of agent.bones) item.bone.rotation.copy(item.base)
      }
    }
  }

  private disposeWildlife(): void {
    const mounted = this.wildlife.filter(agent => agent.mounted)
    for (const agent of this.wildlife) {
      if (agent.mounted) continue
      agent.mixer.stopAllAction()
      agent.root.removeFromParent()
    }
    this.wildlife.length = 0
    this.wildlife.push(...mounted)
  }

  dispose(): void {
    this.disposeWildlife()
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

  updateWildlife(dt: number, player: THREE.Vector3): void {
    for (const chunk of this.chunks.values()) chunk.updateWildlife(dt, player)
  }

  wildlifeAgents(): WildlifeAgent[] {
    return [...this.chunks.values()].flatMap(chunk => chunk.wildlifeAgents())
  }

  relocateMountedAnimal(agent: WildlifeAgent, x: number, y: number, z: number): void {
    const target = this.chunkAt(x, z)
    if (!target) return
    const previous = this.chunkAt(agent.chunkOriginX, agent.chunkOriginZ)
    if (previous !== target) {
      previous?.detachWildlife(agent)
      agent.chunkOriginX = target.cx * CHUNK_SIZE
      agent.chunkOriginZ = target.cz * CHUNK_SIZE
      target.adoptWildlife(agent)
    }
    target.group.add(agent.root)
    agent.position.set(x - agent.chunkOriginX, y, z - agent.chunkOriginZ)
    agent.worldPosition.set(x, y, z)
    agent.root.position.copy(agent.position)
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
  update(px: number, pz: number, maxBuilds = 1, retainedChunk?: { x: number; z: number }): boolean {
    const pcx = Math.floor(px / CHUNK_SIZE)
    const pcz = Math.floor(pz / CHUNK_SIZE)
    const radius = this.viewRadius
    let built = false
    // Unload chunks outside the radius (plus one row of hysteresis).
    for (const [key, chunk] of this.chunks) {
      const retained = retainedChunk && chunk.cx === retainedChunk.x && chunk.cz === retainedChunk.z
      const outside = Math.abs(chunk.cx - pcx) > radius + 1 || Math.abs(chunk.cz - pcz) > radius + 1
      if (outside && !retained) {
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
