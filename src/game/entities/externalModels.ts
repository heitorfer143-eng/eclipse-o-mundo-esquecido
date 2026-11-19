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

export type ExternalAnimation =
  | 'idle' | 'walk' | 'run' | 'attack' | 'attack-heavy' | 'attack-thrust' | 'attack-fast' | 'attack-ranged'
  | 'cast' | 'hit' | 'death' | 'dodge-forward' | 'dodge-backward' | 'dodge-left' | 'dodge-right'
  | 'jump' | 'fall' | 'block'

const ANIMATION_CANDIDATES: Record<ExternalAnimation, string[]> = {
  idle: ['idle', 'stand', 'standing'],
  walk: ['walk', 'walking'],
  run: ['run', 'running', 'sprint', 'walk', 'walking'],
  attack: ['1h_melee_attack_slice_horizontal', '1h_melee_attack_slice_diagonal', '1h_melee_attack_chop'],
  'attack-heavy': ['2h_melee_attack_chop', '2h_melee_attack_slice', '2h_melee_attack_spin'],
  'attack-thrust': ['1h_melee_attack_stab', '2h_melee_attack_stab'],
  'attack-fast': ['dualwield_melee_attack_slice', 'dualwield_melee_attack_stab', '1h_melee_attack_slice_horizontal'],
  'attack-ranged': ['1h_ranged_shoot', '1h_ranged_shooting', '2h_ranged_shoot'],
  cast: ['spellcast_shoot', 'spellcast_raise', 'spellcasting', 'spellcast_long'],
  hit: ['hit_a', 'hit_b'],
  death: ['death_a', 'death_b'],
  'dodge-forward': ['dodge_forward'],
  'dodge-backward': ['dodge_backward'],
  'dodge-left': ['dodge_left'],
  'dodge-right': ['dodge_right'],
  jump: ['jump_full_short', 'jump_start', 'jump_full_long'],
  fall: ['jump_idle'],
  block: ['blocking', 'block'],
}

/** Resolve against normalized real clip names; exposed so every mapping can be covered by tests. */
export function resolveExternalClipName(mode: ExternalAnimation, clipNames: readonly string[]): string | undefined {
  const normalized = clipNames.map(name => name.toLowerCase())
  const candidates = ANIMATION_CANDIDATES[mode]
  for (const candidate of candidates) {
    const exact = normalized.findIndex(name => name === candidate)
    if (exact >= 0) return clipNames[exact]
  }
  for (const candidate of candidates) {
    const partial = normalized.findIndex(name => name.includes(candidate))
    if (partial >= 0) return clipNames[partial]
  }
  return undefined
}

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
    // Cache SkinnedMesh bounds on the source before SkeletonUtils.clone rebinds its bones.
    // Without this, clone-first bounds can collapse to ~0.001 and inflate the model footprint.
    new THREE.Box3().setFromObject(asset.scene)
    const scene = clone(asset.scene) as THREE.Group
    return new ExternalCharacter(scene, asset.animations, targetHeight)
  }

  play(mode: ExternalAnimation, force = false, actionDuration?: number): void {
    const clipName = resolveExternalClipName(mode, [...this.actions.keys()])
    const next = (clipName ? this.actions.get(clipName) : undefined)
      ?? this.actions.get('idle') ?? this.actions.values().next().value
    if (!next || (this.active === next && !force)) return
    this.active?.fadeOut(0.12)
    this.active = next
    this.active.reset().fadeIn(0.12)
    const oneShot = mode === 'death' || mode === 'hit' || mode === 'cast' || mode === 'jump'
      || mode.startsWith('attack') || mode.startsWith('dodge-')
    this.active.setLoop(oneShot ? THREE.LoopOnce : THREE.LoopRepeat, oneShot ? 1 : Infinity)
    this.active.clampWhenFinished = oneShot
    const duration = Number.isFinite(actionDuration) ? Math.max(0.1, actionDuration!) : 0
    const rateSync = oneShot && mode !== 'death' && mode !== 'jump' && duration > 0
      ? this.active.getClip().duration / duration
      : 1
    this.active.timeScale = Math.max(0.65, Math.min(4, rateSync))
    this.active.play()
    this.mode = mode
  }

  update(dt: number, mode?: ExternalAnimation, restart = false, actionDuration?: number): void {
    if (mode && (mode !== this.mode || restart)) this.play(mode, restart, actionDuration)
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
