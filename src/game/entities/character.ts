import * as THREE from 'three'
import type { WeaponKind } from '../data/types'
import { RARITY_COLOR } from '../data/itemData'
import type { Rarity } from '../data/types'
import { clamp, damp } from '../core/math'
import { ExternalCharacter, EXTERNAL_CHARACTER_URLS, HUMANOID_VISUAL_SCALE, type ExternalAnimation } from './externalModels'

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
  private readonly clothMaterial: THREE.MeshStandardMaterial
  private readonly leatherMaterial: THREE.MeshStandardMaterial
  private readonly metalMaterial: THREE.MeshStandardMaterial
  private external?: ExternalCharacter
  private externalMode: ExternalAnimation = 'idle'

  constructor(appearance: Partial<Appearance> = {}, externalUrl: string = EXTERNAL_CHARACTER_URLS.player) {
    this.appearance = { ...DEFAULT_APPEARANCE, ...appearance }
    const skin = mat(this.appearance.skin, { roughness: 0.85 })
    this.clothMaterial = mat(this.appearance.cloth, { roughness: 0.9 })
    this.leatherMaterial = mat(this.appearance.leather, { roughness: 0.85 })
    this.metalMaterial = mat('#a9b0bd', { roughness: 0.4, metalness: 0.75 })
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
    this.aura.rotation.x = -Math.PI / 2
    this.aura.position.y = 0.02
    this.root.add(this.aura)

    this.root.traverse(obj => {
      const mesh = obj as THREE.Mesh
      if (mesh.isMesh && mesh !== this.aura) {
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })
    void ExternalCharacter.load(externalUrl, 1.85).then(model => {
      this.external = model
      this.body.visible = false
      this.aura.visible = true
      this.root.add(model.root)
      model.update(0, this.externalMode)
    }).catch(error => console.warn('Não foi possível carregar personagem 3D externo:', error))
  }

  get hands(): THREE.Object3D {
    return this.weaponSlot
  }

  /** Visible equipment: weapon model, armour plating, helmet and boots. */
  setEquipment(options: { weapon?: WeaponKind; rarity?: Rarity; armor?: boolean; helmet?: boolean; boots?: boolean; auraColor?: string }): void {
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
    if (!this.shoulderL) {
      this.shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6), this.metalMaterial)
      this.shoulderL.position.set(-0.31, 0.54, 0)
      this.shoulderL.scale.set(1.1, 0.8, 1)
      this.shoulderR = this.shoulderL.clone()
      this.shoulderR.position.x = 0.31
      this.torso.add(this.shoulderL, this.shoulderR)
    }
    this.shoulderL.visible = options.armor === true
    this.shoulderR!.visible = options.armor === true
    this.torsoMesh.material = options.armor ? this.metalMaterial : this.clothMaterial
    if (!this.helmet) {
      this.helmet = new THREE.Mesh(new THREE.SphereGeometry(0.215, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), this.metalMaterial)
      this.helmet.position.y = 0.03
      this.head.add(this.helmet)
    }
    this.helmet.visible = options.helmet === true
    this.hairMesh.visible = options.helmet !== true
    const bootMaterial = options.boots ? this.metalMaterial : this.leatherMaterial
    this.footL.material = bootMaterial
    this.footR.material = bootMaterial
    const color = options.auraColor ?? '#7fe3ff'
    ;(this.aura.material as THREE.MeshBasicMaterial).color.set(color)
  }

  /** Pose the rig for the current animation state. Called once per rendered frame. */
  animate(dt: number, state: AnimState): void {
    const externalMode: ExternalAnimation = state.mode === 'walk' ? 'walk'
      : state.mode === 'run' ? 'run'
      : state.mode === 'attack' || state.mode === 'cast' ? 'attack'
      : state.mode === 'hurt' ? 'hit'
      : state.mode === 'dead' ? 'death' : 'idle'
    this.externalMode = externalMode
    this.external?.update(dt, externalMode)
    const speed = state.speed
    const move = clamp(speed / 7, 0, 1)
    if (state.mode === 'walk' || state.mode === 'run') this.walkCycle += dt * (4 + speed * 1.15)
    else this.walkCycle += dt * 1.2

    const cycle = this.walkCycle
    const swing = Math.sin(cycle) * (0.35 + move * 0.55)
    const bob = Math.abs(Math.sin(cycle)) * (0.03 + move * 0.07)
    const lean = move * 0.12

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
    this.cape.rotation.set(0, 0, 0)
    this.capeMesh.scale.set(1, 1, 1)
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
        this.aura.visible = true
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
          this.aura.visible = true
          ;(this.aura.material as THREE.MeshBasicMaterial).color.set('#ffcf6a')
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
        this.aura.visible = true
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
    this.external?.dispose()
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
