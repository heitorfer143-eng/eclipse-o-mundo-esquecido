import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'

const loader = new GLTFLoader()
const cache = new Map<string, Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>>()

function stripRootMotion(clip: THREE.AnimationClip): THREE.AnimationClip {
  clip.tracks = clip.tracks.filter(track => {
    const split = track.name.lastIndexOf('.')
    if (split < 0) return true
    const property = track.name.slice(split + 1)
    const node = track.name.slice(0, split).split(/[/.|:]/).at(-1)?.toLowerCase()
    return !(property === 'position' && (node === 'root' || node === 'hips'))
  })
  clip.resetDuration()
  return clip
}

// Shared visual scale: current humanoid assets are oversized relative to the game's world units.
export const HUMANOID_VISUAL_SCALE = 0.78

export type ExternalAnimation = 'idle' | 'walk' | 'run' | 'attack' | 'hit' | 'death'

export class ExternalCharacter {
  readonly root = new THREE.Group()
  private readonly mixer: THREE.AnimationMixer
  private readonly actions = new Map<string, THREE.AnimationAction>()
  private active?: THREE.AnimationAction
  private mode = ''

  private constructor(scene: THREE.Group, clips: THREE.AnimationClip[], targetHeight: number) {
    const bounds = new THREE.Box3().setFromObject(scene)
    const size = bounds.getSize(new THREE.Vector3())
    const height = Math.max(0.001, size.y)
    scene.scale.setScalar(targetHeight / height)
    const scaledBounds = new THREE.Box3().setFromObject(scene)
    scene.position.y -= scaledBounds.min.y
    // Gobkit models are authored facing +Z; keep their original forward direction.
    scene.traverse(object => {
      const mesh = object as THREE.Mesh
      if (mesh.isMesh) {
        mesh.castShadow = true
        mesh.receiveShadow = false
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          for (const material of materials) material.side = THREE.FrontSide
        }
      }
    })
    this.root.add(scene)
    this.mixer = new THREE.AnimationMixer(scene)
    for (const clip of clips) {
      const key = clip.name.toLowerCase()
      this.actions.set(key, this.mixer.clipAction(clip))
    }
    this.play('idle')
  }

  static async load(url: string, targetHeight: number): Promise<ExternalCharacter> {
    let pending = cache.get(url)
    if (!pending) {
      pending = loader.loadAsync(url).then(gltf => ({
        scene: gltf.scene,
        animations: gltf.animations.map(stripRootMotion),
      }))
      cache.set(url, pending)
      pending.catch(() => cache.delete(url))
    }
    const asset = await pending
    const scene = clone(asset.scene) as THREE.Group
    return new ExternalCharacter(scene, asset.animations, targetHeight)
  }

  play(mode: ExternalAnimation): void {
    const candidates: Record<ExternalAnimation, string[]> = {
      idle: ['idle', 'stand', 'standing'], walk: ['walk', 'walking'], run: ['run', 'running', 'sprint', 'walk', 'walking'],
      attack: ['attack', 'special', 'slash', 'sword'], hit: ['hit', 'hurt', 'hit_receive', 'hitrecieve'], death: ['dead', 'death', 'dying'],
    }
    const next = candidates[mode].map(name => this.actions.get(name)).find(Boolean)
      ?? [...this.actions.entries()].find(([name]) => candidates[mode].some(candidate => name.includes(candidate)))?.[1]
      ?? this.actions.get('idle') ?? this.actions.values().next().value
    if (!next || this.active === next) return
    this.active?.fadeOut(0.12)
    this.active = next
    this.active.reset().fadeIn(0.12)
    this.active.setLoop(mode === 'death' || mode === 'hit' || mode === 'attack' ? THREE.LoopOnce : THREE.LoopRepeat, mode === 'death' ? 1 : Infinity)
    this.active.clampWhenFinished = mode === 'death'
    this.active.play()
    this.mode = mode
  }

  update(dt: number, mode?: ExternalAnimation): void {
    if (mode && mode !== this.mode) this.play(mode)
    this.mixer.update(dt)
  }

  dispose(): void {
    this.mixer.stopAllAction()
    this.root.removeFromParent()
  }
}

export const EXTERNAL_CHARACTER_URLS = {
  player: 'https://gobkit.com/freebies/human003/HeavyWarrior.glb',
  guard: 'https://gobkit.com/freebies/human003/Footman.glb',
  merchant: 'https://gobkit.com/freebies/human017/MarketVendor.glb',
  blacksmith: 'https://gobkit.com/freebies/human010/BloodironSmith.glb',
  mage: 'https://gobkit.com/freebies/human011/NightWitch.glb',
  villager: 'https://gobkit.com/freebies/human003/PeasantMilitia.glb',
  king: 'https://gobkit.com/freebies/human003/King.glb',
  archer: 'https://gobkit.com/freebies/human003/Archer.glb',
  orc: 'https://gobkit.com/freebies/human006/OrcLegionary.glb',
  brute: 'https://gobkit.com/freebies/human010/OrcChainBrute.glb',
  knight: 'https://gobkit.com/freebies/human010/BloodironKnight.glb',
  witch: 'https://gobkit.com/freebies/human011/NightWitch.glb',
  ghost: 'https://gobkit.com/freebies/human011/SheetGhost.glb',
  mummy: 'https://gobkit.com/freebies/human011/TombMummy.glb',
  vampire: 'https://gobkit.com/freebies/human011/VampireCountess.glb',
  werewolf: 'https://gobkit.com/freebies/human011/WerewolfCaptain.glb',
} as const
