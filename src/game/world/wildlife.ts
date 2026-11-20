import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { hash2, mulberry32 } from '../core/rng'
import type { Terrain } from './terrain'

/** Gobkit Animal Pack — CC0 1.0. Models are loaded lazily and shared between instances. */
export const WILDLIFE_ASSETS = {
  corgi: { url: 'https://raw.githubusercontent.com/Ariescar/gobkit-free-assets/main/animal/Corgi.glb', height: 0.72, label: 'Corgi' },
  redPanda: { url: 'https://raw.githubusercontent.com/Ariescar/gobkit-free-assets/main/animal/Red.glb', height: 0.86, label: 'Panda-vermelho' },
  rhino: { url: 'https://raw.githubusercontent.com/Ariescar/gobkit-free-assets/main/animal/Rhino.glb', height: 1.35, label: 'Rinoceronte' },
} as const

type WildlifeId = keyof typeof WILDLIFE_ASSETS
type LoadedAsset = { scene: THREE.Group; clip?: THREE.AnimationClip }
type Wildlife = {
  id: WildlifeId
  root: THREE.Group
  mixer?: THREE.AnimationMixer
  home: THREE.Vector3
  target: THREE.Vector3
  wander: number
  phase: number
  speed: number
}

const loader = new GLTFLoader()
const assetCache = new Map<WildlifeId, Promise<LoadedAsset>>()
const MAX_WILDLIFE = 6
const LOAD_RADIUS = 52
const RECYCLE_RADIUS = 92

function loadAsset(id: WildlifeId): Promise<LoadedAsset> {
  let pending = assetCache.get(id)
  if (!pending) {
    pending = loader.loadAsync(WILDLIFE_ASSETS[id].url).then(gltf => ({
      scene: gltf.scene,
      clip: gltf.animations[0],
    }))
    assetCache.set(id, pending)
    pending.catch(() => assetCache.delete(id))
  }
  return pending
}

function normalize(scene: THREE.Group, targetHeight: number): void {
  const bounds = new THREE.Box3().setFromObject(scene)
  const size = bounds.getSize(new THREE.Vector3())
  scene.scale.setScalar(targetHeight / Math.max(0.001, size.y))
  const fitted = new THREE.Box3().setFromObject(scene)
  const center = fitted.getCenter(new THREE.Vector3())
  scene.position.x -= center.x
  scene.position.z -= center.z
  scene.position.y -= fitted.min.y
  scene.traverse(object => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = false
    if ((object as THREE.SkinnedMesh).isSkinnedMesh) object.frustumCulled = false
  })
}

export class WildlifeManager {
  readonly group = new THREE.Group()
  private readonly animals: Wildlife[] = []
  private readonly rng: () => number
  private disposed = false
  private loading = false
  private lastAnchor = new THREE.Vector3(Number.NaN, 0, Number.NaN)

  constructor(private readonly terrain: Terrain, seed: number, private readonly isBlocked: (x: number, z: number) => boolean) {
    this.group.name = 'ambient-wildlife'
    this.rng = mulberry32((hash2(seed, 0x51f15e, 0x6d2b79f5) * 4294967296) >>> 0)
  }

  private findGroundSpot(player: THREE.Vector3, minRadius = 16, maxRadius = LOAD_RADIUS): THREE.Vector3 | null {
    for (let attempt = 0; attempt < 18; attempt += 1) {
      const angle = this.rng() * Math.PI * 2
      const radius = minRadius + this.rng() * (maxRadius - minRadius)
      const x = player.x + Math.cos(angle) * radius
      const z = player.z + Math.sin(angle) * radius
      const y = this.terrain.heightAt(x, z)
      if (y < 1 || this.terrain.slopeAt(x, z) > 0.32 || this.isBlocked(x, z)) continue
      const biome = this.terrain.biomeAt(x, z, y)
      if (biome === 'oceano' || biome === 'praia' || biome === 'vulcanico' || biome === 'cinzas') continue
      return new THREE.Vector3(x, y + 0.03, z)
    }
    return null
  }

  private async populate(player: THREE.Vector3): Promise<void> {
    if (this.loading || this.disposed) return
    this.loading = true
    try {
      const ids: WildlifeId[] = ['corgi', 'redPanda', 'rhino', 'corgi', 'redPanda', 'rhino']
      for (let index = 0; index < ids.length; index += 1) {
        if (this.disposed) return
        const id = ids[index]
        const home = this.findGroundSpot(player)
        if (!home) continue
        try {
          const asset = await loadAsset(id)
          if (this.disposed) return
          const model = clone(asset.scene) as THREE.Group
          normalize(model, WILDLIFE_ASSETS[id].height)
          const root = new THREE.Group()
          root.add(model)
          root.position.copy(home)
          root.rotation.y = this.rng() * Math.PI * 2
          let mixer: THREE.AnimationMixer | undefined
          if (asset.clip) {
            mixer = new THREE.AnimationMixer(model)
            mixer.clipAction(asset.clip).play()
            mixer.setTime(0)
          }
          this.group.add(root)
          this.animals.push({
            id, root, mixer, home: home.clone(), target: home.clone(),
            wander: 1 + this.rng() * 4, phase: this.rng() * Math.PI * 2,
            speed: id === 'rhino' ? 0.72 : 0.95,
          })
        } catch (error) {
          console.warn(`Animal 3D (${WILDLIFE_ASSETS[id].label}) indisponível:`, error)
        }
      }
    } finally {
      this.loading = false
    }
  }

  update(dt: number, player: THREE.Vector3): void {
    if (this.disposed) return
    if (this.animals.length < MAX_WILDLIFE && !this.loading
      && (!Number.isFinite(this.lastAnchor.x) || this.lastAnchor.distanceToSquared(player) > 24 * 24)) {
      this.lastAnchor.copy(player)
      void this.populate(player.clone())
    }

    for (const animal of this.animals) {
      const distance = Math.hypot(animal.root.position.x - player.x, animal.root.position.z - player.z)
      if (distance > RECYCLE_RADIUS) {
        const next = this.findGroundSpot(player, 24, 58)
        if (next) {
          animal.home.copy(next)
          animal.target.copy(next)
          animal.root.position.copy(next)
          animal.wander = 0.5 + this.rng() * 2
        }
      }
      animal.wander -= dt
      const dx = animal.target.x - animal.root.position.x
      const dz = animal.target.z - animal.root.position.z
      const moving = Math.hypot(dx, dz) > 0.16
      if (!moving && animal.wander <= 0) {
        const angle = this.rng() * Math.PI * 2
        const radius = 1.5 + this.rng() * 4.5
        const x = animal.home.x + Math.cos(angle) * radius
        const z = animal.home.z + Math.sin(angle) * radius
        if (!this.isBlocked(x, z)) {
          animal.target.set(x, this.terrain.heightAt(x, z) + 0.03, z)
        }
        animal.wander = 2.5 + this.rng() * 5
      }
      if (moving) {
        const length = Math.hypot(dx, dz)
        const step = Math.min(length, animal.speed * dt)
        animal.root.position.x += dx / length * step
        animal.root.position.z += dz / length * step
        animal.root.position.y = this.terrain.heightAt(animal.root.position.x, animal.root.position.z) + 0.03
        animal.root.rotation.y = Math.atan2(dx, dz)
      }
      animal.phase += dt
      if (animal.mixer) {
        // Gobkit packs bake idle (0–29) and walk (90–119) into one 24 fps clip.
        const segmentStart = moving ? 90 / 24 : 0
        const segmentDuration = 30 / 24
        const local = (animal.phase * (moving ? 1 : 0.55)) % segmentDuration
        animal.mixer.setTime(segmentStart + local)
      }
    }
  }

  dispose(): void {
    this.disposed = true
    for (const animal of this.animals) {
      animal.mixer?.stopAllAction()
      animal.root.removeFromParent()
    }
    this.animals.length = 0
    this.group.removeFromParent()
  }

  get count(): number {
    return this.animals.length
  }
}
