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
  attack: ['attack', '1h_melee_attack_slice_horizontal', '1h_melee_attack_slice_diagonal', '1h_melee_attack_chop'],
  'attack-heavy': ['attack', 'special', '2h_melee_attack_chop', '2h_melee_attack_slice', '2h_melee_attack_spin'],
  'attack-thrust': ['attack', '1h_melee_attack_stab', '2h_melee_attack_stab'],
  'attack-fast': ['attack', 'dualwield_melee_attack_slice', 'dualwield_melee_attack_stab', '1h_melee_attack_slice_horizontal'],
  'attack-ranged': ['attack', '1h_ranged_shoot', '1h_ranged_shooting', '2h_ranged_shoot'],
  cast: ['special', 'cast', 'spellcast_shoot', 'spellcast_raise', 'spellcasting', 'spellcast_long'],
  hit: ['hit', 'hit_a', 'hit_b'],
  death: ['dead', 'death', 'death_a', 'death_b'],
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

type MotionBone = { bone: THREE.Bone; base: THREE.Euler; phase: number; amplitude: number }

export class ExternalCharacter {
  readonly root = new THREE.Group()
  private readonly mixer: THREE.AnimationMixer
  private readonly actions = new Map<string, THREE.AnimationAction>()
  private readonly motionBones: MotionBone[] = []
  private active?: THREE.AnimationAction
  private mode = ''
  private motionPhase = 0
  private deathElapsed = 0
  private fallbackPoseActive = false

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
    let boneIndex = 0
    scene.traverse(object => {
      const bone = object as THREE.Bone
      if (!bone.isBone) return
      const name = bone.name.toLowerCase().replace(/[^a-z]/g, '')
      const leg = /upleg|thigh|lowerleg|leg|calf|shin|paw/.test(name)
      const arm = /upperarm|lowerarm|arm/.test(name)
      if (!leg && !arm) return
      const left = /left|(^|[^a-z])l($|[^a-z])/.test(bone.name.toLowerCase())
      const phase = arm ? (left ? Math.PI : 0) : (left ? 0 : Math.PI)
      this.motionBones.push({ bone, base: bone.rotation.clone(), phase: phase + (boneIndex % 2) * 0.12, amplitude: leg ? 0.42 : 0.24 })
      boneIndex += 1
    })
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
    if (mode === 'death' && !clipName) {
      this.active?.fadeOut(0.08)
      this.active = undefined
      this.mode = mode
      this.deathElapsed = 0
      return
    }
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
    if (mode !== 'death') {
      this.deathElapsed = 0
      this.root.position.y = 0
      this.root.rotation.z = 0
    }
  }

  update(dt: number, mode?: ExternalAnimation, restart = false, actionDuration?: number): void {
    const currentMode = mode ?? this.mode as ExternalAnimation
    if (mode && (mode !== this.mode || restart)) this.play(mode, restart, actionDuration)
    const names = [...this.actions.keys()]
    const fallbackDeath = currentMode === 'death' && !resolveExternalClipName('death', names)
    const fallbackLocomotion = (currentMode === 'walk' || currentMode === 'run') && !resolveExternalClipName(currentMode, names)
    if (!fallbackDeath && !fallbackLocomotion && this.fallbackPoseActive) {
      this.resetFallbackPose()
      this.fallbackPoseActive = false
    }
    this.mixer.update(dt)
    if (fallbackDeath) {
      this.fallbackPoseActive = true
      this.animateFallbackDeath(dt)
    } else if (fallbackLocomotion) {
      this.fallbackPoseActive = true
      this.animateFallbackLocomotion(dt, currentMode as 'walk' | 'run')
    }
  }

  private animateFallbackLocomotion(dt: number, mode: 'walk' | 'run'): void {
    this.motionPhase += dt * (mode === 'run' ? 10.5 : 7.2)
    this.root.position.y = Math.sin(this.motionPhase * 2) * 0.025
    for (const item of this.motionBones) {
      const swing = Math.sin(this.motionPhase + item.phase) * item.amplitude
      item.bone.rotation.set(item.base.x + swing, item.base.y, item.base.z)
    }
  }

  private animateFallbackDeath(dt: number): void {
    this.deathElapsed = Math.min(1.2, this.deathElapsed + dt)
    const t = Math.min(1, this.deathElapsed / 0.9)
    this.root.rotation.z = -t * 1.1
    this.root.position.y = -t * 0.42
    for (const item of this.motionBones) item.bone.rotation.copy(item.base)
  }

  private resetFallbackPose(): void {
    this.root.position.y = 0
    this.root.rotation.z = 0
    for (const item of this.motionBones) item.bone.rotation.copy(item.base)
  }

  dispose(): void {
    this.mixer.stopAllAction()
    this.root.removeFromParent()
  }
}

/** Select a licensed humanoid replacement; non-humanoid creatures keep their bespoke procedural silhouette. */
export function externalHumanoidUrlForModel(model: string, variantId?: string): string | undefined {
  // Named variants stop every goblin, guard and boss from sharing one identical silhouette.
  const variants: Record<string, string> = {
    'goblin-xama': EXTERNAL_CHARACTER_URLS.orcShaman,
    'bandido-emboscador': EXTERNAL_CHARACTER_URLS.scout,
    'cavaleiro-corrompido': EXTERNAL_CHARACTER_URLS.knight,
    'cavaleiro-do-vazio': EXTERNAL_CHARACTER_URLS.juggernaut,
    'mumia-errante': EXTERNAL_CHARACTER_URLS.mummy,
    'esqueleto-guerreiro': EXTERNAL_CHARACTER_URLS.mummy,
    'espectro-do-eclipse': EXTERNAL_CHARACTER_URLS.ghost,
    'bruxa-do-lodo': EXTERNAL_CHARACTER_URLS.witch,
    'diabrete-de-magma': EXTERNAL_CHARACTER_URLS.orcPyromancer,
    'yeti-das-neves': EXTERNAL_CHARACTER_URLS.werewolf,
    'sacerdote-corrompido': EXTERNAL_CHARACTER_URLS.priestess,
    'tharwyn-raiz-esmagadora': EXTERNAL_CHARACTER_URLS.orcChampion,
    'sarkhys-emboscada-areia': EXTERNAL_CHARACTER_URLS.vampire,
    'hrimgar-punho-avalanche': EXTERNAL_CHARACTER_URLS.juggernaut,
    'ignivar-bafo-magma': EXTERNAL_CHARACTER_URLS.orcPyromancer,
  }
  if (variantId && Object.hasOwn(variants, variantId)) return variants[variantId]
  if (model === 'cavaleiro') return EXTERNAL_CHARACTER_URLS.knight
  if (model === 'esqueleto' || model === 'mumia') return EXTERNAL_CHARACTER_URLS.mummy
  if (model === 'goblin') return EXTERNAL_CHARACTER_URLS.orc
  if (model === 'gigante' || model === 'troll') return EXTERNAL_CHARACTER_URLS.brute
  if (model === 'espectro') return EXTERNAL_CHARACTER_URLS.ghost
  if (model === 'yeti') return EXTERNAL_CHARACTER_URLS.werewolf
  if (model === 'elemental' || model === 'golem' || model === 'serpente') return undefined
  return undefined
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
  orcShaman: 'https://gobkit.com/freebies/human006/OrcWarShaman.glb',
  orcCommander: 'https://gobkit.com/freebies/human006/OrcLegionCommander.glb',
  orcChampion: 'https://gobkit.com/freebies/human006/OrcWarbandChampion.glb',
  orcShieldBearer: 'https://gobkit.com/freebies/human006/OrcShieldBearer.glb',
  orcPyromancer: 'https://gobkit.com/freebies/human010/OrcPyromancer.glb',
  brute: 'https://gobkit.com/freebies/human010/OrcChainBrute.glb',
  knight: 'https://gobkit.com/freebies/human010/BloodironKnight.glb',
  knightCaptain: 'https://gobkit.com/freebies/human003/KnightCaptain.glb',
  juggernaut: 'https://gobkit.com/freebies/human010/BloodironJuggernaut.glb',
  halberdier: 'https://gobkit.com/freebies/human010/BloodironHalberdier.glb',
  grunt: 'https://gobkit.com/freebies/human010/BloodironGrunt.glb',
  scout: 'https://gobkit.com/freebies/human003/Scout.glb',
  priestess: 'https://gobkit.com/freebies/human003/Priestess.glb',
  farmer: 'https://gobkit.com/freebies/human017/FarmHand.glb',
  bartender: 'https://gobkit.com/freebies/human021/Bartender.glb',
  witchDoctor: 'https://gobkit.com/freebies/human010/OrcPyromancer.glb',
  witch: 'https://gobkit.com/freebies/human011/NightWitch.glb',
  ghost: 'https://gobkit.com/freebies/human011/SheetGhost.glb',
  mummy: 'https://gobkit.com/freebies/human011/TombMummy.glb',
  vampire: 'https://gobkit.com/freebies/human011/VampireCountess.glb',
  werewolf: 'https://gobkit.com/freebies/human011/WerewolfCaptain.glb',
} as const
