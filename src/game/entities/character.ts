import * as THREE from 'three'
import type { WeaponKind } from '../data/types'
import { RARITY_COLOR } from '../data/itemData'
import type { Rarity } from '../data/types'
import { clamp, damp } from '../core/math'
import { ExternalCharacter, EXTERNAL_CHARACTER_URLS, HUMANOID_VISUAL_SCALE, type ExternalAnimation, type ExternalMaterialPalette } from './externalModels'
import type { CharacterModelId } from '../data/characterProfile'
import { characterModelUrlFor } from './characterAssets'

export type AnimMode =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'fall'
  | 'glide'
  | 'roll'
  | 'swim'
  | 'climb'
  | 'attack'
  | 'cast'
  | 'block'
  | 'hurt'
  | 'dead'

export type AnimState = {
  mode: AnimMode
  /** Horizontal speed in m/s. */
  speed: number
  /** Seconds since the current one-shot action started. */
  actionTime: number
  /** Duration of the current one-shot action. */
  actionDuration: number
  combo: number
  /** Weapon used for the swing pose. */
  weapon: WeaponKind
  charging: boolean
  rollDirection?: 'forward' | 'backward' | 'left' | 'right'
}

/** Select real KayKit clips where available; keep one central mapping for tests and rendering. */
export function externalAnimationFor(state: AnimState): ExternalAnimation {
  if (state.mode === 'attack') {
    if (state.weapon === 'arco') return 'attack-ranged'
    if (state.weapon === 'lanca') return 'attack-thrust'
    if (state.weapon === 'machado' || state.weapon === 'espadao' || state.weapon === 'cajado') return 'attack-heavy'
    if (state.weapon === 'adaga') return 'attack-fast'
    return 'attack'
  }
  if (state.mode === 'roll') return `dodge-${state.rollDirection ?? 'forward'}` as ExternalAnimation
  switch (state.mode) {
    case 'walk': return 'walk'
    case 'run': return 'run'
    case 'jump': return 'jump'
    case 'fall': return 'fall'
    case 'block': return 'block'
    case 'cast': return 'cast'
    case 'hurt': return 'hit'
    case 'dead': return 'death'
    default: return 'idle'
  }
}

export type Appearance = {
  skin: string
  cloth: string
  clothAccent: string
  leather: string
  hair: string
}

const DEFAULT_APPEARANCE: Appearance = {
  skin: '#d8a884',
  cloth: '#3f5d78',
  clothAccent: '#c8a45c',
  leather: '#5a4130',
  hair: '#2a2024',
}

function mat(color: string, opts: { roughness?: number; metalness?: number; emissive?: string; emissiveIntensity?: number } = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.75,
    metalness: opts.metalness ?? 0.05,
    flatShading: true,
    emissive: opts.emissive ? new THREE.Color(opts.emissive) : new THREE.Color('#000000'),
    emissiveIntensity: opts.emissiveIntensity ?? 0,
  })
}

type ArmorVisualStyle = 'andarilho' | 'sentinela' | 'eclipse' | 'aetherion'
type ArmorPalette = { main: string; trim: string; accent: string; roughness: number; metalness: number; glow: string; glowIntensity: number }

const ARMOR_PALETTES: Record<ArmorVisualStyle, ArmorPalette> = {
  andarilho: { main: '#765238', trim: '#3b2b21', accent: '#c08b49', roughness: 0.88, metalness: 0.08, glow: '#000000', glowIntensity: 0 },
  sentinela: { main: '#b9c2cb', trim: '#4b5360', accent: '#d4b86b', roughness: 0.34, metalness: 0.8, glow: '#000000', glowIntensity: 0 },
  eclipse: { main: '#30283f', trim: '#17131f', accent: '#aa6cf2', roughness: 0.38, metalness: 0.62, glow: '#6e36a8', glowIntensity: 0.5 },
  aetherion: { main: '#c4a253', trim: '#3c4d56', accent: '#79dce7', roughness: 0.32, metalness: 0.78, glow: '#3baebb', glowIntensity: 0.42 },
}

type ProceduralPoseSample = { object: THREE.Object3D; position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3 }

function capturePose(objects: readonly THREE.Object3D[]): ProceduralPoseSample[] {
  return objects.map(object => ({
    object,
    position: object.position.clone(),
    quaternion: object.quaternion.clone(),
    scale: object.scale.clone(),
  }))
}

function blendPoseFrom(samples: readonly ProceduralPoseSample[], dt: number): void {
  const weight = 1 - Math.exp(-Math.max(0, dt) * 14)
  for (const sample of samples) {
    sample.object.position.lerp(sample.position, weight)
    sample.object.quaternion.slerp(sample.quaternion, weight)
    sample.object.scale.lerp(sample.scale, weight)
  }
}

function armorPlateGeometry(width: number, height: number, depth: number): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(-width * 0.46, height * 0.44)
  shape.lineTo(width * 0.46, height * 0.44)
  shape.lineTo(width * 0.42, height * 0.02)
  shape.lineTo(width * 0.2, -height * 0.34)
  shape.lineTo(0, -height * 0.5)
  shape.lineTo(-width * 0.2, -height * 0.34)
  shape.lineTo(-width * 0.42, height * 0.02)
  shape.closePath()
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.008,
    bevelThickness: 0.008,
  })
}

function loinclothGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(-0.15, 0.08)
  shape.lineTo(0.15, 0.08)
  shape.lineTo(0.11, -0.05)
  shape.lineTo(0, -0.24)
  shape.lineTo(-0.11, -0.05)
  shape.closePath()
  return new THREE.ShapeGeometry(shape)
}

/** Builds the weapon mesh for a weapon family, pointing along -Z from the grip. */
export function buildWeapon(kind: WeaponKind, rarity: Rarity = 'comum'): THREE.Group {
  const group = new THREE.Group()
  const glow = RARITY_COLOR[rarity]
  const steel = mat('#c9ced8', { roughness: 0.35, metalness: 0.85 })
  const darkSteel = mat('#8f96a3', { roughness: 0.45, metalness: 0.8 })
  const wood = mat('#5b4128', { roughness: 0.9 })
  const gold = mat('#c9a659', { roughness: 0.35, metalness: 0.9 })
  const gem = mat(glow, { roughness: 0.2, emissive: glow, emissiveIntensity: 1.4 })
  const add = (mesh: THREE.Mesh, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    mesh.position.set(x, y, z)
    mesh.rotation.set(rx, ry, rz)
    mesh.castShadow = true
    group.add(mesh)
    return mesh
  }
  switch (kind) {
    case 'espada': {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.05, 0.022), steel), 0, 0.72, 0)
      add(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 4), steel), 0, 1.32, 0)
      add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.06), gold), 0, 0.19, 0)
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.26, 6), wood), 0, 0.05, 0)
      add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), gold), 0, -0.1, 0)
      break
    }
    case 'espadao': {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.17, 1.55, 0.035), steel), 0, 1.0, 0)
      add(new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.26, 4), steel), 0, 1.9, 0)
      add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.08), darkSteel), 0, 0.2, 0)
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.4, 6), wood), 0, -0.02, 0)
      add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.2, 0.045), gem), 0, 1.0, 0)
      break
    }
    case 'adaga': {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.018), steel), 0, 0.4, 0)
      add(new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 4), steel), 0, 0.71, 0)
      add(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 0.04), darkSteel), 0, 0.14, 0)
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.18, 6), wood), 0, 0.03, 0)
      break
    }
    case 'lanca': {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 2.5, 6), wood), 0, 1.15, 0)
      add(new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.42, 5), steel), 0, 2.55, 0)
      add(new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 6, 10), gold), 0, 2.3, 0, Math.PI / 2)
      break
    }
    case 'arco': {
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 6, 18, Math.PI * 1.15), wood)
      add(bow, 0, 0.55, 0, 0, 0, Math.PI / 2)
      const stringMat = new THREE.LineBasicMaterial({ color: '#e8e2cf' })
      const points = [new THREE.Vector3(0, 1.15, 0), new THREE.Vector3(0, 0.55, -0.16), new THREE.Vector3(0, -0.05, 0)]
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), stringMat)
      group.add(line)
      add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), gem), 0, 0.55, -0.05)
      break
    }
    case 'cajado': {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.9, 6), wood), 0, 0.85, 0)
      add(new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.028, 6, 10), gold), 0, 1.86, 0, Math.PI / 2)
      add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), gem), 0, 1.86, 0)
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.2, 5), gold), 0, 1.7, 0)
      break
    }
    case 'machado': {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.042, 1.15, 6), wood), 0, 0.45, 0)
      add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.06), steel), 0.2, 1.02, 0)
      add(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.34, 3), steel), 0.42, 1.02, 0, 0, 0, -Math.PI / 2)
      add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.09), darkSteel), 0, 1.02, 0)
      break
    }
  }
  group.rotation.x = kind === 'lanca' ? 0.1 : -0.15
  return group
}

/**
 * Stylised humanoid assembled from primitives with real joint pivots, so locomotion, attacks and
 * equipment changes read clearly without external rigs.
 */
export class CharacterModel {
  readonly root = new THREE.Group()
  readonly body = new THREE.Group()
  private readonly hips = new THREE.Group()
  private readonly torso = new THREE.Group()
  private readonly head = new THREE.Group()
  private readonly armL = new THREE.Group()
  private readonly armR = new THREE.Group()
  private readonly foreL = new THREE.Group()
  private readonly foreR = new THREE.Group()
  private readonly legL = new THREE.Group()
  private readonly legR = new THREE.Group()
  private readonly shinL = new THREE.Group()
  private readonly shinR = new THREE.Group()
  private readonly cape = new THREE.Group()
  private readonly weaponSlot = new THREE.Group()
  private readonly shieldSlot = new THREE.Group()
  private readonly torsoMesh: THREE.Mesh
  private readonly hipMesh: THREE.Mesh
  private readonly headMesh: THREE.Mesh
  private readonly hairMesh: THREE.Mesh
  private readonly footL: THREE.Mesh
  private readonly footR: THREE.Mesh
  private readonly capeMesh: THREE.Mesh
  private readonly eyeMaterial: THREE.MeshStandardMaterial
  private helmet?: THREE.Mesh
  private shoulderL?: THREE.Mesh
  private shoulderR?: THREE.Mesh
  private weapon?: THREE.Group
  private aura: THREE.Mesh
  private appearance: Appearance
  private walkCycle = 0
  private blinkTimer = 2
  private readonly skinMaterial: THREE.MeshStandardMaterial
  private readonly clothMaterial: THREE.MeshStandardMaterial
  private readonly leatherMaterial: THREE.MeshStandardMaterial
  private readonly underwearMaterial: THREE.MeshStandardMaterial
  private readonly armorMaterial: THREE.MeshStandardMaterial
  private readonly armorTrimMaterial: THREE.MeshStandardMaterial
  private readonly armorAccentMaterial: THREE.MeshStandardMaterial
  private readonly armorTorsoGroup = new THREE.Group()
  private readonly armorWaistGroup = new THREE.Group()
  private readonly forearmArmorL = new THREE.Group()
  private readonly forearmArmorR = new THREE.Group()
  private readonly bootArmorL = new THREE.Group()
  private readonly bootArmorR = new THREE.Group()
  private external?: ExternalCharacter
  private externalMode: ExternalAnimation = 'idle'
  private externalActionTime = 0
  private externalUrl = ''
  private selectedModelId: CharacterModelId = 'Survivor'
  private equippedArmor = false
  private equippedHelmet = false
  private equippedBoots = false
  private externalRequest = 0
  private disposed = false
  private auraEnabled = false
  private externalMaterialPalette?: ExternalMaterialPalette
  private survivorAppearance = false
  private armorStyle: ArmorVisualStyle = 'andarilho'

  constructor(appearance: Partial<Appearance> = {}, externalUrl: string = EXTERNAL_CHARACTER_URLS.player, externalYaw = 0, selectedModelId?: CharacterModelId, externalMaterialPalette?: ExternalMaterialPalette) {
    this.appearance = { ...DEFAULT_APPEARANCE, ...appearance }
    this.externalMaterialPalette = externalMaterialPalette
    this.selectedModelId = selectedModelId ?? (externalUrl ? 'Knight' : 'Survivor')
    const skin = mat(this.appearance.skin, { roughness: 0.85 })
    this.skinMaterial = skin
    this.clothMaterial = mat(this.appearance.cloth, { roughness: 0.9 })
    this.leatherMaterial = mat(this.appearance.leather, { roughness: 0.85 })
    this.underwearMaterial = mat('#613d2d', { roughness: 0.98 })
    this.armorMaterial = mat('#765238', { roughness: 0.88, metalness: 0.08 })
    this.armorTrimMaterial = mat('#3b2b21', { roughness: 0.72, metalness: 0.12 })
    this.armorAccentMaterial = mat('#c08b49', { roughness: 0.42, metalness: 0.68 })
    this.applyArmorStyle('andarilho')
    const accent = mat(this.appearance.clothAccent, { roughness: 0.6, metalness: 0.2 })
    const hair = mat(this.appearance.hair, { roughness: 0.95 })
    this.eyeMaterial = mat('#8fe8ff', { roughness: 0.2, emissive: '#6fe0ff', emissiveIntensity: 1.4 })

    this.root.scale.setScalar(HUMANOID_VISUAL_SCALE)
    this.root.add(this.body)
    this.body.add(this.hips)
    this.hips.position.y = 0.9
    this.hipMesh = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.28, 0.3), this.leatherMaterial)
    this.hips.add(this.hipMesh)

    this.torso.position.y = 0.14
    this.hips.add(this.torso)
    this.torsoMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.34, 4, 10), this.clothMaterial)
    this.torsoMesh.position.y = 0.3
    this.torsoMesh.scale.set(1.05, 1, 0.8)
    this.torso.add(this.torsoMesh)
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 10), this.leatherMaterial)
    belt.position.y = 0.06
    this.torso.add(belt)
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.04), accent)
    buckle.position.set(0, 0.06, -0.24)
    this.torso.add(buckle)

    this.head.position.y = 0.78
    this.torso.add(this.head)
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.12, 6), skin)
    neck.position.y = -0.1
    this.head.add(neck)
    this.headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), skin)
    this.headMesh.scale.set(1, 1.08, 0.94)
    this.head.add(this.headMesh)
    this.hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.212, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), hair)
    this.hairMesh.position.y = 0.02
    this.head.add(this.hairMesh)
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), this.eyeMaterial)
    eyeL.position.set(-0.075, 0.02, -0.18)
    const eyeR = eyeL.clone()
    eyeR.position.x = 0.075
    this.head.add(eyeL, eyeR)

    // Arms
    this.armL.position.set(-0.33, 0.46, 0)
    this.armR.position.set(0.33, 0.46, 0)
    this.torso.add(this.armL, this.armR)
    const upperL = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.22, 4, 8), this.clothMaterial)
    upperL.position.y = -0.14
    const upperR = upperL.clone()
    this.armL.add(upperL)
    this.armR.add(upperR)
    this.foreL.position.y = -0.28
    this.foreR.position.y = -0.28
    this.armL.add(this.foreL)
    this.armR.add(this.foreR)
    const foreL = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.2, 4, 8), this.clothMaterial)
    foreL.position.y = -0.13
    const foreR = foreL.clone()
    this.foreL.add(foreL)
    this.foreR.add(foreR)
    const handL = new THREE.Mesh(new THREE.SphereGeometry(0.072, 8, 6), skin)
    handL.position.y = -0.28
    const handR = handL.clone()
    this.foreL.add(handL)
    this.foreR.add(handR)
    this.weaponSlot.position.set(0, -0.3, 0)
    this.weaponSlot.rotation.x = Math.PI / 2
    this.foreR.add(this.weaponSlot)
    this.shieldSlot.position.set(0, -0.26, 0)
    this.foreL.add(this.shieldSlot)

    // Legs
    this.legL.position.set(-0.13, -0.06, 0)
    this.legR.position.set(0.13, -0.06, 0)
    this.hips.add(this.legL, this.legR)
    const thighL = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.24, 4, 8), this.leatherMaterial)
    thighL.position.y = -0.18
    const thighR = thighL.clone()
    this.legL.add(thighL)
    this.legR.add(thighR)
    this.shinL.position.y = -0.36
    this.shinR.position.y = -0.36
    this.legL.add(this.shinL)
    this.legR.add(this.shinR)
    const shinL = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.24, 4, 8), this.leatherMaterial)
    shinL.position.y = -0.18
    const shinR = shinL.clone()
    this.shinL.add(shinL)
    this.shinR.add(shinR)
    this.footL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.28), this.leatherMaterial)
    this.footL.position.set(0, -0.38, -0.05)
    this.footR = this.footL.clone()
    this.shinL.add(this.footL)
    this.shinR.add(this.footR)

    const loinclothFront = new THREE.Mesh(loinclothGeometry(), this.underwearMaterial)
    loinclothFront.name = 'survivor-loincloth-front'
    loinclothFront.position.set(0, -0.015, -0.155)
    loinclothFront.rotation.y = Math.PI
    const loinclothBack = new THREE.Mesh(loinclothGeometry(), this.underwearMaterial)
    loinclothBack.name = 'survivor-loincloth-back'
    loinclothBack.position.set(0, -0.015, 0.155)
    this.hips.add(loinclothFront, loinclothBack)
    this.buildArmorMeshes()

    // Cape / cloak that also acts as the glide surface.
    this.cape.position.set(0, 0.48, 0.19)
    this.torso.add(this.cape)
    this.capeMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.95, 1, 3), mat(this.appearance.clothAccent, { roughness: 0.95 }))
    this.capeMesh.position.y = -0.42
    this.capeMesh.rotation.x = 0.08
    ;(this.capeMesh.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide
    this.cape.add(this.capeMesh)

    // Soft aura ring under the character for readability at distance.
    this.aura = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.46, 24),
      new THREE.MeshBasicMaterial({ color: '#7fe3ff', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }),
    )
    this.aura.name = 'character-aura'
    this.aura.rotation.x = -Math.PI / 2
    this.aura.position.y = 0.02
    this.root.add(this.aura)
    this.aura.visible = false

    // New campaigns use this local rig: bare skin and a simple loincloth, not a baked armour GLB.
    this.root.traverse(obj => {
      const mesh = obj as THREE.Mesh
      if (mesh.isMesh && mesh !== this.aura) {
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })
    if (!externalUrl) this.enableSurvivorAppearance()
    this.setExternalModelUrl(externalUrl, externalYaw)
  }

  get hands(): THREE.Object3D {
    return this.weaponSlot
  }

  get visibleGearState(): Readonly<{ survivor: boolean; armor: boolean; helmet: boolean; boots: boolean }> {
    return {
      survivor: this.survivorAppearance,
      armor: this.armorTorsoGroup.visible,
      helmet: this.helmet?.visible ?? false,
      boots: this.bootArmorL.visible && this.bootArmorR.visible,
    }
  }

  /** Swap a licensed model lazily; new class profiles use their outfit/armor pair. */
  setKayKitModel(id: CharacterModelId): void {
    this.selectedModelId = id
    if (id === 'Survivor') {
      this.setProceduralAppearance()
      return
    }
    this.setExternalModelUrl(characterModelUrlFor(id, this.equippedArmor), Math.PI)
  }

  private enableSurvivorAppearance(): void {
    this.survivorAppearance = true
    this.body.traverse(object => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      if (mesh.material === this.clothMaterial || mesh.material === this.leatherMaterial) mesh.material = this.skinMaterial
    })
    this.hipMesh.material = this.underwearMaterial
    this.torsoMesh.material = this.skinMaterial
    this.footL.material = this.skinMaterial
    this.footR.material = this.skinMaterial
    if (this.shoulderL) this.shoulderL.visible = false
    if (this.shoulderR) this.shoulderR.visible = false
    if (this.helmet) this.helmet.visible = false
    this.hairMesh.visible = true
    this.cape.visible = false
  }

  private setProceduralAppearance(): void {
    if (this.disposed) return
    this.externalRequest += 1
    this.external?.dispose()
    this.external = undefined
    this.externalUrl = ''
    this.body.visible = true
    this.aura.visible = this.auraEnabled
    this.enableSurvivorAppearance()
  }

  private setExternalModelUrl(url: string, yaw: number): void {
    if (this.disposed || !url || url === this.externalUrl) return
    this.externalUrl = url
    const request = ++this.externalRequest
    void ExternalCharacter.load(url, 1.85, this.externalMaterialPalette).then(model => {
      if (this.disposed || request !== this.externalRequest) {
        model.dispose()
        return
      }
      this.external?.dispose()
      this.external = model
      this.survivorAppearance = false
      this.body.visible = false
      this.aura.visible = this.auraEnabled
      model.root.rotation.y = yaw
      this.root.add(model.root)
      model.update(0, this.externalMode)
    }).catch(error => {
      if (!this.disposed && request === this.externalRequest) {
        console.warn('Não foi possível carregar personagem 3D externo:', error)
      }
    })
  }

  setAuraColor(_color: string): void {
    this.aura.visible = false
  }

  setAuraEnabled(_enabled: boolean): void {
    this.auraEnabled = false
    this.aura.visible = false
  }

  private buildArmorMeshes(): void {
    this.armorTorsoGroup.name = 'equipment-armor-torso'
    this.armorTorsoGroup.visible = false
    this.torso.add(this.armorTorsoGroup)
    const cuirass = new THREE.Mesh(new THREE.CapsuleGeometry(0.282, 0.37, 4, 10), this.armorMaterial)
    cuirass.name = 'equipment-cuirass-shell'
    cuirass.position.y = 0.3
    cuirass.scale.set(1.06, 1.02, 0.94)
    this.armorTorsoGroup.add(cuirass)

    const breastplate = new THREE.Mesh(armorPlateGeometry(0.39, 0.41, 0.035), this.armorMaterial)
    breastplate.name = 'equipment-breastplate'
    breastplate.position.set(0, 0.3, -0.238)
    breastplate.rotation.y = Math.PI
    const breastInset = new THREE.Mesh(armorPlateGeometry(0.23, 0.25, 0.016), this.armorTrimMaterial)
    breastInset.name = 'equipment-breastplate-inset'
    breastInset.position.set(0, 0.31, -0.275)
    breastInset.rotation.y = Math.PI
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.2, 0.016), this.armorAccentMaterial)
    crest.name = 'equipment-breastplate-crest'
    crest.position.set(0, 0.31, -0.294)
    const medallion = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 0), this.armorAccentMaterial)
    medallion.name = 'equipment-breastplate-medallion'
    medallion.position.set(0, 0.39, -0.3)
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.022, 5, 12), this.armorTrimMaterial)
    collar.name = 'equipment-collar'
    collar.rotation.x = Math.PI / 2
    collar.position.y = 0.68
    this.armorTorsoGroup.add(breastplate, breastInset, crest, medallion, collar)

    this.shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.145, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.66), this.armorMaterial)
    this.shoulderL.name = 'equipment-pauldron-left'
    this.shoulderL.position.set(-0.33, 0.53, 0)
    this.shoulderL.scale.set(1.18, 0.9, 1.14)
    this.shoulderR = this.shoulderL.clone()
    this.shoulderR.name = 'equipment-pauldron-right'
    this.shoulderR.position.x = 0.33
    const pauldronRidgeL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.025, 0.16), this.armorAccentMaterial)
    pauldronRidgeL.position.set(0, 0.055, -0.025)
    const pauldronRidgeR = pauldronRidgeL.clone()
    this.shoulderL.add(pauldronRidgeL)
    this.shoulderR.add(pauldronRidgeR)
    this.armorTorsoGroup.add(this.shoulderL, this.shoulderR)

    this.armorWaistGroup.name = 'equipment-armor-waist'
    this.armorWaistGroup.visible = false
    this.hips.add(this.armorWaistGroup)
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.075, 10), this.armorTrimMaterial)
    belt.name = 'equipment-armor-belt'
    belt.position.y = 0.13
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.035), this.armorAccentMaterial)
    buckle.name = 'equipment-armor-buckle'
    buckle.position.set(0, 0.13, -0.255)
    this.armorWaistGroup.add(belt, buckle)
    for (const x of [-0.12, 0, 0.12]) {
      const tasset = new THREE.Mesh(armorPlateGeometry(0.15, 0.24, 0.022), this.armorMaterial)
      tasset.name = 'equipment-tasset'
      tasset.position.set(x, -0.075, -0.155)
      tasset.rotation.y = Math.PI
      this.armorWaistGroup.add(tasset)
    }

    this.forearmArmorL.name = 'equipment-forearm-left'
    this.forearmArmorR.name = 'equipment-forearm-right'
    this.forearmArmorL.visible = false
    this.forearmArmorR.visible = false
    this.foreL.add(this.forearmArmorL)
    this.foreR.add(this.forearmArmorR)
    for (const [group, side] of [[this.forearmArmorL, 'left'], [this.forearmArmorR, 'right']] as const) {
      const bracer = new THREE.Mesh(new THREE.CapsuleGeometry(0.074, 0.15, 3, 8), this.armorMaterial)
      bracer.name = `equipment-bracer-${side}`
      bracer.position.y = -0.13
      const plate = new THREE.Mesh(armorPlateGeometry(0.085, 0.13, 0.018), this.armorAccentMaterial)
      plate.name = `equipment-bracer-plate-${side}`
      plate.position.set(0, -0.13, -0.061)
      plate.rotation.y = Math.PI
      group.add(bracer, plate)
    }

    this.bootArmorL.name = 'equipment-greave-left'
    this.bootArmorR.name = 'equipment-greave-right'
    this.bootArmorL.visible = false
    this.bootArmorR.visible = false
    this.shinL.add(this.bootArmorL)
    this.shinR.add(this.bootArmorR)
    for (const [group, side] of [[this.bootArmorL, 'left'], [this.bootArmorR, 'right']] as const) {
      const greave = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.105, 0.3, 8), this.armorMaterial)
      greave.name = `equipment-greave-shell-${side}`
      greave.position.y = -0.18
      const plate = new THREE.Mesh(armorPlateGeometry(0.11, 0.25, 0.02), this.armorAccentMaterial)
      plate.name = `equipment-greave-plate-${side}`
      plate.position.set(0, -0.18, -0.075)
      plate.rotation.y = Math.PI
      group.add(greave, plate)
    }
  }

  private applyArmorStyle(requestedStyle?: string): void {
    const style = requestedStyle && requestedStyle in ARMOR_PALETTES
      ? requestedStyle as ArmorVisualStyle
      : this.armorStyle
    this.armorStyle = style
    const palette = ARMOR_PALETTES[style]
    this.armorMaterial.color.set(palette.main)
    this.armorMaterial.roughness = palette.roughness
    this.armorMaterial.metalness = palette.metalness
    this.armorTrimMaterial.color.set(palette.trim)
    this.armorAccentMaterial.color.set(palette.accent)
    this.armorAccentMaterial.emissive.set(palette.glow)
    this.armorAccentMaterial.emissiveIntensity = palette.glowIntensity
  }

  /** Visible equipment: weapon model, armour plating, helmet and boots. */
  setEquipment(options: { weapon?: WeaponKind; rarity?: Rarity; armor?: boolean; helmet?: boolean; boots?: boolean; armorStyle?: string; auraColor?: string }): void {
    if (this.weapon) {
      this.weaponSlot.remove(this.weapon)
      this.weapon.traverse(obj => {
        const mesh = obj as THREE.Mesh
        if (mesh.isMesh) mesh.geometry.dispose()
      })
      this.weapon = undefined
    }
    if (options.weapon) {
      this.weapon = buildWeapon(options.weapon, options.rarity ?? 'comum')
      this.weaponSlot.add(this.weapon)
    }
    this.applyArmorStyle(options.armorStyle)
    const armorVisible = options.armor ?? this.equippedArmor
    const helmetVisible = options.helmet ?? this.equippedHelmet
    const bootsVisible = options.boots ?? this.equippedBoots
    this.equippedArmor = armorVisible
    this.equippedHelmet = helmetVisible
    this.equippedBoots = bootsVisible
    if (this.selectedModelId === 'Soldier' || this.selectedModelId === 'Paladin') {
      this.setExternalModelUrl(characterModelUrlFor(this.selectedModelId, armorVisible), Math.PI)
    }
    this.armorTorsoGroup.visible = armorVisible
    this.armorWaistGroup.visible = armorVisible
    this.forearmArmorL.visible = armorVisible
    this.forearmArmorR.visible = armorVisible
    this.shoulderL!.visible = armorVisible
    this.shoulderR!.visible = armorVisible
    this.torsoMesh.material = this.survivorAppearance ? this.skinMaterial : this.clothMaterial
    this.hipMesh.material = this.survivorAppearance ? this.underwearMaterial : this.leatherMaterial
    if (!this.helmet) {
      this.helmet = new THREE.Mesh(new THREE.SphereGeometry(0.215, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), this.armorMaterial)
      this.helmet.name = 'equipment-helmet'
      this.helmet.position.y = 0.03
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.035, 0.035), this.armorTrimMaterial)
      visor.name = 'equipment-helmet-visor'
      visor.position.set(0, -0.015, -0.18)
      const crest = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.15, 4), this.armorAccentMaterial)
      crest.name = 'equipment-helmet-crest'
      crest.position.set(0, 0.16, -0.02)
      this.helmet.add(visor, crest)
      this.head.add(this.helmet)
    }
    this.helmet.visible = helmetVisible
    this.hairMesh.visible = !helmetVisible
    this.bootArmorL.visible = bootsVisible
    this.bootArmorR.visible = bootsVisible
    const bootMaterial = bootsVisible ? this.armorMaterial : this.survivorAppearance ? this.skinMaterial : this.leatherMaterial
    this.footL.material = bootMaterial
    this.footR.material = bootMaterial
  }

  /** Pose the rig for the current animation state. Called once per rendered frame. */
  animate(dt: number, state: AnimState): void {
    const externalMode = externalAnimationFor(state)
    const oneShot = state.mode === 'attack' || state.mode === 'cast' || state.mode === 'roll'
      || state.mode === 'jump' || state.mode === 'hurt' || state.mode === 'dead'
    const restartAction = oneShot && this.externalMode === externalMode && state.actionTime < this.externalActionTime - 0.001
    this.external?.update(dt, externalMode, restartAction, state.actionDuration, state.actionTime, state.charging)
    this.externalMode = externalMode
    this.externalActionTime = state.actionTime
    const speed = state.speed
    const move = clamp(speed / 7, 0, 1)
    if (state.mode === 'walk' || state.mode === 'run') this.walkCycle += dt * (4 + speed * 1.15)
    else if (state.mode !== 'idle') this.walkCycle += dt * 1.2

    const cycle = this.walkCycle
    const swing = Math.sin(cycle) * (0.35 + move * 0.55)
    const bob = Math.abs(Math.sin(cycle)) * (0.03 + move * 0.07)
    const lean = move * 0.12

    // Keep the previous visual pose, then blend toward this frame's target pose.
    // These transforms are visual children only; the character root and gameplay colliders stay fixed.
    const previousPose = capturePose([
      this.body, this.hips, this.torso, this.head, this.armL, this.armR, this.foreL, this.foreR,
      this.legL, this.legR, this.shinL, this.shinR, this.cape, this.capeMesh,
    ])

    // Reset to a neutral stance, then layer the state.
    this.body.position.set(0, 0, 0)
    this.body.rotation.set(0, 0, 0)
    this.hips.rotation.set(0, 0, 0)
    this.torso.rotation.set(0, 0, 0)
    this.head.rotation.set(0, 0, 0)
    this.armL.rotation.set(0, 0, 0.06)
    this.armR.rotation.set(0, 0, -0.06)
    this.foreL.rotation.set(0.1, 0, 0)
    this.foreR.rotation.set(0.1, 0, 0)
    this.legL.rotation.set(0, 0, 0.02)
    this.legR.rotation.set(0, 0, -0.02)
    this.shinL.rotation.set(0, 0, 0)
    this.shinR.rotation.set(0, 0, 0)
    this.torso.position.set(0, 0.14, 0)
    this.cape.rotation.set(0, 0, 0)
    this.capeMesh.scale.set(1, 1, 1)
    this.cape.visible = !this.survivorAppearance || state.mode === 'glide'
    this.aura.visible = false

    const breath = Math.sin(performance.now() * 0.0018) * 0.02

    switch (state.mode) {
      case 'idle': {
        this.torso.position.y = 0.14 + breath * 0.3
        this.torso.rotation.x = breath * 0.4
        this.armL.rotation.z = 0.09 + breath * 0.4
        this.armR.rotation.z = -0.09 - breath * 0.4
        this.head.rotation.y = Math.sin(performance.now() * 0.00035) * 0.22
        break
      }
      case 'walk':
      case 'run': {
        this.body.position.y = bob
        this.body.rotation.x = lean
        this.legL.rotation.x = swing
        this.legR.rotation.x = -swing
        this.shinL.rotation.x = Math.max(0, -swing) * 1.1
        this.shinR.rotation.x = Math.max(0, swing) * 1.1
        this.armL.rotation.x = -swing * 0.75
        this.armR.rotation.x = swing * 0.75
        this.foreL.rotation.x = 0.2 + Math.max(0, swing) * 0.4
        this.foreR.rotation.x = 0.2 + Math.max(0, -swing) * 0.4
        this.torso.rotation.y = Math.sin(cycle) * 0.06 * (0.4 + move)
        this.cape.rotation.x = 0.18 + move * 0.45
        this.capeMesh.scale.y = 1 + move * 0.1
        this.head.rotation.x = -lean * 0.4
        break
      }
      case 'jump': {
        this.legL.rotation.x = -0.55
        this.shinL.rotation.x = 0.9
        this.legR.rotation.x = 0.25
        this.shinR.rotation.x = 0.4
        this.armL.rotation.x = -1.1
        this.armR.rotation.x = -1.1
        this.armL.rotation.z = 0.4
        this.armR.rotation.z = -0.4
        this.torso.rotation.x = -0.12
        this.cape.rotation.x = 0.5
        break
      }
      case 'fall': {
        this.legL.rotation.x = 0.2
        this.legR.rotation.x = -0.15
        this.armL.rotation.z = 0.8
        this.armR.rotation.z = -0.8
        this.armL.rotation.x = -0.35
        this.armR.rotation.x = -0.35
        this.cape.rotation.x = 0.7
        break
      }
      case 'glide': {
        this.body.rotation.x = -0.35
        this.armL.rotation.z = 1.35
        this.armR.rotation.z = -1.35
        this.armL.rotation.x = -0.2
        this.armR.rotation.x = -0.2
        this.legL.rotation.x = 0.1
        this.legR.rotation.x = 0.1
        this.cape.rotation.x = 1.25
        this.capeMesh.scale.set(2.6, 1.15, 1)
        this.aura.visible = this.auraEnabled
        break
      }
      case 'roll': {
        const t = clamp(state.actionTime / Math.max(0.01, state.actionDuration), 0, 1)
        this.body.rotation.x = -t * Math.PI * 2
        this.body.position.y = Math.sin(t * Math.PI) * 0.25
        this.legL.rotation.x = -1.1
        this.legR.rotation.x = -1.1
        this.shinL.rotation.x = 1.4
        this.shinR.rotation.x = 1.4
        this.armL.rotation.x = -1.4
        this.armR.rotation.x = -1.4
        break
      }
      case 'swim': {
        this.body.rotation.x = -1.1
        this.body.position.y = 0.35
        const stroke = Math.sin(cycle * 1.6)
        this.armL.rotation.x = stroke * 1.1
        this.armR.rotation.x = -stroke * 1.1
        this.armL.rotation.z = 0.5
        this.armR.rotation.z = -0.5
        this.legL.rotation.x = stroke * 0.5
        this.legR.rotation.x = -stroke * 0.5
        break
      }
      case 'climb': {
        const climbCycle = Math.sin(performance.now() * 0.006)
        this.armL.rotation.x = -2.4 + climbCycle * 0.4
        this.armR.rotation.x = -2.4 - climbCycle * 0.4
        this.armL.rotation.z = 0.3
        this.armR.rotation.z = -0.3
        this.legL.rotation.x = -0.5 + climbCycle * 0.3
        this.legR.rotation.x = -0.5 - climbCycle * 0.3
        this.body.rotation.x = -0.2
        break
      }
      case 'attack': {
        const t = clamp(state.actionTime / Math.max(0.01, state.actionDuration), 0, 1)
        const windup = clamp(t / 0.35, 0, 1)
        const strike = clamp((t - 0.35) / 0.3, 0, 1)
        const recover = clamp((t - 0.65) / 0.35, 0, 1)
        const weapon = state.weapon
        const heavy = weapon === 'espadao' || weapon === 'machado'
        const thrust = weapon === 'lanca'
        const quick = weapon === 'adaga'
        const combo = state.combo % 3
        if (thrust) {
          this.armR.rotation.x = -0.4 - windup * 0.6 + strike * 2.1
          this.armL.rotation.x = -0.3 - windup * 0.4 + strike * 1.2
          this.torso.rotation.y = -0.5 + strike * 1.0
          this.body.position.z = -strike * 0.25 + recover * 0.25
        } else {
          const dir = combo === 1 ? -1 : 1
          this.armR.rotation.x = -0.3 - windup * (heavy ? 2.4 : 1.9) + strike * (heavy ? 3.4 : 2.8)
          this.armR.rotation.z = -0.1 + windup * 0.9 * dir - strike * 1.3 * dir
          this.armL.rotation.x = -0.2 - windup * 0.8 + strike * 1.2
          this.torso.rotation.y = windup * 0.55 * dir - strike * 1.15 * dir
          this.hips.rotation.y = windup * 0.25 * dir - strike * 0.5 * dir
          this.body.position.z = -strike * (heavy ? 0.3 : 0.18) + recover * 0.2
        }
        if (quick) {
          this.armR.rotation.x *= 1.2
          this.torso.rotation.y *= 1.35
        }
        if (state.charging) {
          this.armR.rotation.x = -1.9
          this.armR.rotation.z = -0.7
          this.torso.rotation.y = 0.6
          this.body.position.y = -0.06
          this.aura.visible = this.auraEnabled
        }
        this.legL.rotation.x = -0.25
        this.legR.rotation.x = 0.3
        this.shinR.rotation.x = 0.25
        this.cape.rotation.x = 0.35
        break
      }
      case 'cast': {
        const t = clamp(state.actionTime / Math.max(0.01, state.actionDuration), 0, 1)
        const raise = Math.sin(clamp(t / 0.4, 0, 1) * Math.PI * 0.5)
        this.armR.rotation.x = -1.6 * raise
        this.armL.rotation.x = -1.2 * raise
        this.armR.rotation.z = -0.35
        this.armL.rotation.z = 0.35
        this.torso.rotation.x = -0.12 * raise
        this.head.rotation.x = -0.15 * raise
        this.aura.visible = this.auraEnabled
        break
      }
      case 'block': {
        this.armL.rotation.x = -1.5
        this.armL.rotation.z = 0.9
        this.foreL.rotation.x = 1.4
        this.armR.rotation.x = -0.6
        this.armR.rotation.z = -0.5
        this.torso.rotation.y = -0.3
        this.hips.rotation.y = -0.15
        this.legL.rotation.x = -0.15
        this.legR.rotation.x = 0.2
        this.body.position.y = -0.04
        break
      }
      case 'hurt': {
        const t = clamp(state.actionTime / Math.max(0.01, state.actionDuration), 0, 1)
        this.body.rotation.x = 0.35 * (1 - t)
        this.body.position.z = 0.2 * (1 - t)
        this.armL.rotation.x = -0.6
        this.armR.rotation.x = -0.6
        this.head.rotation.x = 0.3
        break
      }
      case 'dead': {
        this.body.rotation.x = 1.45
        this.body.position.y = -0.55
        this.armL.rotation.z = 0.5
        this.armR.rotation.z = -0.5
        break
      }
    }

    blendPoseFrom(previousPose, dt)

    // Eyelids: occasional blink.
    this.blinkTimer -= dt
    if (this.blinkTimer < 0) this.blinkTimer = 2 + Math.random() * 4
    const blinking = this.blinkTimer < 0.08
    this.headMesh.scale.y = blinking ? 0.92 : 1.08

    // Damp the aura so it fades instead of popping.
    const auraMaterial = this.aura.material as THREE.MeshBasicMaterial
    auraMaterial.opacity = damp(auraMaterial.opacity, this.aura.visible ? 0.45 : 0.2, 6, dt)
  }

  dispose(): void {
    this.disposed = true
    this.externalRequest += 1
    this.external?.dispose()
    this.external = undefined
    this.root.traverse(obj => {
      const mesh = obj as THREE.Mesh
      if (mesh.isMesh) {
        mesh.geometry.dispose()
        const material = mesh.material
        for (const m of Array.isArray(material) ? material : [material]) m.dispose()
      }
    })
  }
}
