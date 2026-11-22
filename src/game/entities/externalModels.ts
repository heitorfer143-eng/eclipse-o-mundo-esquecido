import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'

const loader = new GLTFLoader()
const cache = new Map<string, Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>>()

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export type ExternalMaterialPalette = Partial<Record<
  'skin' | 'face' | 'hair' | 'shirt' | 'pants' | 'belt' | 'main' | 'black' | 'darkgreen'
  | 'helmet' | 'armor' | 'armorDark' | 'detail' | 'red', string
>>

const MATERIAL_PALETTE_KEYS: Record<string, keyof ExternalMaterialPalette> = {
  skin: 'skin', face: 'face', hair: 'hair', shirt: 'shirt', pants: 'pants', belt: 'belt',
  main: 'main', black: 'black', darkgreen: 'darkgreen', helmet: 'helmet', armor: 'armor',
  armordark: 'armorDark', detail: 'detail', red: 'red',
}

function applyMaterialPalette(scene: THREE.Group, palette?: ExternalMaterialPalette): void {
  if (!palette) return
  const copies = new Map<THREE.Material, THREE.Material>()
  scene.traverse(object => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    const tint = (material: THREE.Material): THREE.Material => {
      let copy = copies.get(material)
      if (!copy) {
        copy = material.clone()
        copies.set(material, copy)
        const key = MATERIAL_PALETTE_KEYS[material.name.toLowerCase().replace(/[^a-z]/g, '')]
        const color = key ? palette[key] : undefined
        if (color && 'color' in copy) (copy as THREE.MeshStandardMaterial).color.set(color)
      }
      return copy
    }
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(tint) : tint(mesh.material)
  })
}

function stripRootMotion(clip: THREE.AnimationClip): THREE.AnimationClip {
  clip.tracks = clip.tracks.filter(track => {
    const split = track.name.lastIndexOf('.')
    if (split < 0) return true
    const property = track.name.slice(split + 1).replace(/\[.*$/, '').toLowerCase()
    const path = track.name.slice(0, split)
    const bracketNode = path.match(/\[([^\]]+)\]/)?.[1]
    const rawNode = bracketNode ?? path.split(/[/.|:]/).at(-1) ?? ''
    const node = rawNode.toLowerCase().replace(/[^a-z]/g, '').replace(/^mixamorig/, '')
    const isRoot = node === 'root' || node.endsWith('root')
    const isHips = node.includes('hips') || node.endsWith('pelvis')
    return !(property === 'position' && (isRoot || isHips))
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
  attack: ['attack', 'swordslash', '1h_melee_attack_slice_horizontal', '1h_melee_attack_slice_diagonal', '1h_melee_attack_chop'],
  'attack-heavy': ['attack', 'swordslash', 'special', '2h_melee_attack_chop', '2h_melee_attack_slice', '2h_melee_attack_spin'],
  'attack-thrust': ['attack', 'swordslash', '1h_melee_attack_stab', '2h_melee_attack_stab'],
  'attack-fast': ['attack', 'punch', 'dualwield_melee_attack_slice', 'dualwield_melee_attack_stab', '1h_melee_attack_slice_horizontal'],
  'attack-ranged': ['attack', 'shoot_onehanded', '1h_ranged_shoot', '1h_ranged_shooting', '2h_ranged_shoot'],
  cast: ['special', 'cast', 'shoot_onehanded', 'spellcast_shoot', 'spellcast_raise', 'spellcasting', 'spellcast_long'],
  hit: ['hit', 'hit_a', 'hit_b', 'recievehit'],
  death: ['dead', 'death', 'death_a', 'death_b'],
  'dodge-forward': ['dodge_forward', 'roll'],
  'dodge-backward': ['dodge_backward', 'roll'],
  'dodge-left': ['dodge_left', 'roll'],
  'dodge-right': ['dodge_right', 'roll'],
  jump: ['jump', 'jump_full_short', 'jump_start', 'jump_full_long'],
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

type MotionBone = {
  bone: THREE.Bone
  base: THREE.Quaternion
  phase: number
  amplitude: number
  role: 'arm' | 'leg' | 'torso'
  side: -1 | 1
  distal: boolean
}

export class ExternalCharacter {
  readonly root = new THREE.Group()
  private readonly mixer: THREE.AnimationMixer
  private readonly actions = new Map<string, THREE.AnimationAction>()
  private readonly motionBones: MotionBone[] = []
  private active?: THREE.AnimationAction
  private mode = ''
  private motionPhase = 0
  private fallbackPoseWeight = 0

  private constructor(scene: THREE.Group, clips: THREE.AnimationClip[], targetHeight: number, palette?: ExternalMaterialPalette) {
    const bounds = new THREE.Box3().setFromObject(scene)
    const size = bounds.getSize(new THREE.Vector3())
    const height = Math.max(0.001, size.y)
    scene.scale.setScalar(targetHeight / height)
    const scaledBounds = new THREE.Box3().setFromObject(scene)
    scene.position.y -= scaledBounds.min.y
    applyMaterialPalette(scene, palette)
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
      const name = bone.name.toLowerCase().replace(/[^a-z]/g, '').replace(/^mixamorig/, '')
      const leg = /upleg|thigh|lowerleg|leg|calf|shin|paw/.test(name)
      const arm = /upperarm|lowerarm|arm/.test(name)
      const torso = /spine|chest|hips|pelvis|neck/.test(name)
      if (!leg && !arm && !torso) return
      const left = name.includes('left') || name.endsWith('l')
      const phase = arm ? (left ? Math.PI : 0) : (left ? 0 : Math.PI)
      const role = leg ? 'leg' : arm ? 'arm' : 'torso'
      this.motionBones.push({
        bone,
        base: bone.quaternion.clone(),
        phase: phase + (boneIndex % 2) * 0.12,
        amplitude: leg ? 0.42 : 0.24,
        role,
        side: left ? -1 : 1,
        distal: /lower|fore|hand|wrist|shin|calf|foot/.test(name),
      })
      boneIndex += 1
    })
    this.mixer = new THREE.AnimationMixer(scene)
    for (const clip of clips) {
      const key = clip.name.toLowerCase()
      this.actions.set(key, this.mixer.clipAction(clip))
    }
    this.play('idle')
  }

  static async load(url: string, targetHeight: number, palette?: ExternalMaterialPalette): Promise<ExternalCharacter> {
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
    return new ExternalCharacter(scene, asset.animations, targetHeight, palette)
  }

  play(mode: ExternalAnimation, force = false, actionDuration?: number): void {
    const clipName = resolveExternalClipName(mode, [...this.actions.keys()])
    const next = (clipName ? this.actions.get(clipName) : undefined)
      ?? this.actions.get('idle') ?? this.actions.values().next().value
    if (!next) {
      this.mode = mode
      return
    }
    if (this.active === next && !force) {
      this.mode = mode
      return
    }
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

  update(dt: number, mode?: ExternalAnimation, restart = false, actionDuration?: number, actionTime = 0, charging = false): void {
    const currentMode = mode ?? this.mode as ExternalAnimation
    if (mode && (mode !== this.mode || restart)) this.play(mode, restart, actionDuration)
    const names = [...this.actions.keys()]
    const hasClip = Boolean(resolveExternalClipName(currentMode, names))
    const fallbackLocomotion = (currentMode === 'walk' || currentMode === 'run') && !hasClip
    const fallbackAction = !hasClip && (
      currentMode === 'death' || currentMode === 'hit' || currentMode === 'block'
      || currentMode.startsWith('attack') || currentMode.startsWith('dodge-')
      || (currentMode === 'attack' && charging)
    )
    const wantsFallback = fallbackLocomotion || fallbackAction
    this.mixer.update(dt)
    this.fallbackPoseWeight += ((wantsFallback ? 1 : 0) - this.fallbackPoseWeight) * (1 - Math.exp(-Math.max(0, dt) * 14))
    if (this.fallbackPoseWeight > 0.001) this.animateFallbackPose(dt, currentMode, actionTime, actionDuration, charging, fallbackLocomotion, this.fallbackPoseWeight)
  }

  private animateFallbackPose(
    dt: number,
    mode: ExternalAnimation,
    actionTime: number,
    actionDuration: number | undefined,
    charging: boolean,
    locomotion: boolean,
    weight: number,
  ): void {
    if (locomotion) this.motionPhase += dt * (mode === 'run' ? 10.5 : 7.2)
    const t = clamp01(actionTime / Math.max(0.1, actionDuration ?? 0.8))
    const windup = clamp01(t / 0.35)
    const strike = clamp01((t - 0.28) / 0.34)
    const recover = clamp01((t - 0.62) / 0.38)
    for (const item of this.motionBones) {
      let x = 0
      let y = 0
      let z = 0
      if (locomotion && item.role !== 'torso') {
        const swing = Math.sin(this.motionPhase + item.phase) * item.amplitude
        x += item.role === 'leg' ? swing : -swing * 0.65
      } else if (mode === 'death') {
        if (item.role === 'torso') x += 1.15
        else if (item.role === 'arm') { x += item.distal ? 0.35 : 0.55; z += item.side * 0.35 }
        else x += item.distal ? 0.7 : 0.45
      } else if (mode === 'hit') {
        if (item.role === 'torso') x += 0.38 * (1 - t)
        else if (item.role === 'arm') x -= 0.58 * (1 - t)
      } else if (mode === 'block') {
        if (item.role === 'arm') { x -= item.distal ? 0.85 : 1.05; z += item.side * 0.3 }
        if (item.role === 'torso') y -= 0.18
      } else if (mode.startsWith('dodge-')) {
        if (item.role === 'torso') { x += 0.2 + Math.sin(t * Math.PI * 2) * 0.3; z += mode === 'dodge-left' ? -0.35 : mode === 'dodge-right' ? 0.35 : 0 }
        else if (item.role === 'arm') x -= item.distal ? 1.0 : 1.3
        else x += item.distal ? 1.15 : -0.85
      } else if (mode.startsWith('attack')) {
        if (charging) {
          if (item.role === 'arm') { x -= item.distal ? 0.55 : 1.25; z += item.side * 0.22 }
        } else if (item.role === 'arm') {
          x += item.side === 1
            ? -0.35 - 0.85 * windup + 1.75 * strike - 0.55 * recover
            : -0.2 - 0.35 * windup + 0.75 * strike
          z += item.side * (0.12 + 0.35 * windup - 0.5 * strike)
        } else if (item.role === 'torso') y += 0.35 * windup - 0.7 * strike + 0.3 * recover
        else x -= 0.18
      }
      const baseEuler = new THREE.Euler().setFromQuaternion(item.base, item.bone.rotation.order)
      const target = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        baseEuler.x + x,
        baseEuler.y + y,
        baseEuler.z + z,
        item.bone.rotation.order,
      ))
      // Blend from the active mixer pose, so clips and procedural fallbacks crossfade naturally.
      item.bone.quaternion.slerp(target, weight)
    }
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
