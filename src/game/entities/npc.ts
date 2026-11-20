import * as THREE from 'three'
import type { NpcDef } from '../data/types'
import { clamp, dampAngle } from '../core/math'
import { CharacterModel, type Appearance } from './character'
import { EXTERNAL_CHARACTER_URLS, HUMANOID_VISUAL_SCALE } from './externalModels'
import { resolveCircle, type Collider } from '../world/collision'

const ROLE_COLORS: Record<string, { cloth: string; accent: string; leather: string; skin: string; hair: string }> = {
  ferreiro: { cloth: '#5a4030', accent: '#8a6a45', leather: '#3a2a20', skin: '#c98f63', hair: '#3a2a24' },
  mercador: { cloth: '#3f6a52', accent: '#c8a45c', leather: '#4a3524', skin: '#d8a884', hair: '#5a3a28' },
  alquimista: { cloth: '#4a3f6a', accent: '#9ad1a0', leather: '#3a3048', skin: '#e0b394', hair: '#7a5a3a' },
  taverneiro: { cloth: '#7a4a3a', accent: '#e0c088', leather: '#4a3020', skin: '#d8a884', hair: '#4a2a1a' },
  anciao: { cloth: '#5a5a6a', accent: '#c8c0a0', leather: '#3a3a44', skin: '#cfa07a', hair: '#cfcfcf' },
  guarda: { cloth: '#3a4a62', accent: '#9aa8bc', leather: '#2a3038', skin: '#c98f63', hair: '#2a2024' },
  mago: { cloth: '#3a2f5a', accent: '#8f7fd0', leather: '#2a2440', skin: '#d8b090', hair: '#b0b0c8' },
  pescador: { cloth: '#3a5a62', accent: '#a8c8c0', leather: '#4a3a2a', skin: '#c08050', hair: '#4a3a2a' },
  campones: { cloth: '#6a6a4a', accent: '#c0b080', leather: '#4a3a28', skin: '#d0a070', hair: '#5a4028' },
  crianca: { cloth: '#6a5a8a', accent: '#e0c0d0', leather: '#4a3a48', skin: '#e8b898', hair: '#8a5a30' },
  cacador: { cloth: '#3a4a34', accent: '#8a7a4a', leather: '#3a2a1a', skin: '#c08858', hair: '#3a2a1a' },
  sacerdote: { cloth: '#d8d0c0', accent: '#d8b45a', leather: '#8a7a5a', skin: '#e0b090', hair: '#a0a0a0' },
}

const QUEST_MARKER_MATERIALS = {
  offer: makeQuestMarkerMaterial('!', '#f3c65b'),
  turnIn: makeQuestMarkerMaterial('?', '#7fe0a2'),
}

/** A townsperson: procedural body, floating nameplate and a small idle routine. */
export class Npc {
  readonly def: NpcDef
  readonly root = new THREE.Group()
  readonly position = new THREE.Vector3()
  readonly model: CharacterModel
  private readonly label: THREE.Sprite
  private readonly offerMarker: THREE.Sprite
  private readonly turnInMarker: THREE.Sprite
  private questMarkerKind: 'offer' | 'turnIn' | null = null
  private readonly home: THREE.Vector3
  private target = new THREE.Vector3()
  private wanderTimer = 2
  private animTime = Math.random() * 10
  private facing = 0
  private talking = false

  constructor(def: NpcDef, x: number, z: number, groundY: number, facing = 0, private readonly colliders: readonly Collider[] = []) {
    this.def = def
    const palette = ROLE_COLORS[def.role] ?? ROLE_COLORS.campones
    const appearance: Partial<Appearance> = {
      skin: palette.skin,
      cloth: def.colors.body,
      clothAccent: def.colors.accent,
      leather: palette.leather,
      hair: palette.hair,
    }
    const modelUrl = def.name.includes('Capit') ? EXTERNAL_CHARACTER_URLS.knightCaptain
      : def.role === 'guarda' ? EXTERNAL_CHARACTER_URLS.guard
      : def.role === 'ferreiro' ? EXTERNAL_CHARACTER_URLS.blacksmith
      : def.role === 'mercador' ? EXTERNAL_CHARACTER_URLS.merchant
      : def.role === 'taverneiro' ? EXTERNAL_CHARACTER_URLS.bartender
      : def.role === 'mago' ? EXTERNAL_CHARACTER_URLS.mage
      : def.role === 'alquimista' ? EXTERNAL_CHARACTER_URLS.witch
      : def.role === 'sacerdote' ? EXTERNAL_CHARACTER_URLS.priestess
      : def.role === 'anciao' ? EXTERNAL_CHARACTER_URLS.king
      : def.role === 'cacador' ? EXTERNAL_CHARACTER_URLS.archer
      : def.role === 'campones' ? EXTERNAL_CHARACTER_URLS.farmer
      : EXTERNAL_CHARACTER_URLS.villager
    this.model = new CharacterModel(appearance, modelUrl)
    this.model.setEquipment({ weapon: def.role === 'guarda' ? 'lanca' : def.role === 'cacador' ? 'arco' : undefined, armor: def.role === 'guarda', helmet: def.role === 'guarda' })
    const scale = def.role === 'crianca' ? 0.72 : 1
    this.model.root.scale.multiplyScalar(scale)
    this.root.add(this.model.root)
    this.position.set(x, groundY, z)
    this.home = this.position.clone()
    this.target.copy(this.position)
    this.facing = facing
    this.root.position.copy(this.position)
    this.root.rotation.y = facing

    this.label = makeNameplate(def.name, def.role)
    this.label.position.y = 2.25 * HUMANOID_VISUAL_SCALE * scale
    this.root.add(this.label)
    this.offerMarker = new THREE.Sprite(QUEST_MARKER_MATERIALS.offer)
    this.turnInMarker = new THREE.Sprite(QUEST_MARKER_MATERIALS.turnIn)
    for (const marker of [this.offerMarker, this.turnInMarker]) {
      marker.position.set(0, 2.35, 0)
      marker.scale.set(0.48, 0.58, 1)
      marker.visible = false
      this.root.add(marker)
    }
  }

  setTalking(talking: boolean): void {
    this.talking = talking
    this.label.visible = !talking
    this.updateQuestMarkerVisibility(0)
  }

  setQuestMarker(kind: 'offer' | 'turnIn' | null): void {
    this.questMarkerKind = kind
    this.updateQuestMarkerVisibility(0)
  }

  private updateQuestMarkerVisibility(distance: number): void {
    const visible = !this.talking && distance < 45
    this.offerMarker.visible = visible && this.questMarkerKind === 'offer'
    this.turnInMarker.visible = visible && this.questMarkerKind === 'turnIn'
  }

  update(dt: number, playerPosition: THREE.Vector3, playerNear: boolean): void {
    this.animTime += dt
    const distanceToPlayer = Math.hypot(playerPosition.x - this.position.x, playerPosition.z - this.position.z)
    this.updateQuestMarkerVisibility(distanceToPlayer)
    let moving = false
    if (playerNear && distanceToPlayer < 5) {
      this.facing = dampAngle(this.facing, Math.atan2(-(playerPosition.x - this.position.x), -(playerPosition.z - this.position.z)), 6, dt)
    } else if (!this.talking) {
      this.wanderTimer -= dt
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 4 + Math.random() * 6
        const angle = Math.random() * Math.PI * 2
        const radius = Math.random() * 3.5
        this.target.set(this.home.x + Math.cos(angle) * radius, this.position.y, this.home.z + Math.sin(angle) * radius)
      }
      const toTarget = new THREE.Vector3(this.target.x - this.position.x, 0, this.target.z - this.position.z)
      if (toTarget.length() > 0.6) {
        toTarget.normalize()
        const speed = this.def.routine === 'vigiar' ? 0.5 : 0.85
        const previousX = this.position.x
        const previousZ = this.position.z
        let nextX = previousX + toTarget.x * speed * dt
        let nextZ = previousZ + toTarget.z * speed * dt
        let hitStructure = false
        for (const collider of this.colliders) {
          const resolved = resolveCircle(nextX, nextZ, 0.34, collider, this.position.y, this.position.y + 1.8, true)
          if (!resolved) continue
          nextX = resolved.x
          nextZ = resolved.z
          hitStructure = true
        }
        this.position.x = nextX
        this.position.z = nextZ
        if (hitStructure) {
          this.target.copy(this.position)
          this.wanderTimer = 1.5
        }
        this.facing = dampAngle(this.facing, Math.atan2(-toTarget.x, -toTarget.z), 5, dt)
        moving = Math.hypot(this.position.x - previousX, this.position.z - previousZ) > 0.02
      }
    }
    this.root.position.copy(this.position)
    this.root.rotation.y = this.facing
    this.model.animate(dt, {
      mode: moving ? 'walk' : 'idle',
      speed: moving ? 1.2 : 0,
      actionTime: 0,
      actionDuration: 1,
      combo: 0,
      weapon: this.def.role === 'guarda' ? 'lanca' : this.def.role === 'cacador' ? 'arco' : 'espada',
      charging: false,
    })
    // Nameplates fade with distance so towns stay readable but not cluttered.
    const material = this.label.material as THREE.SpriteMaterial
    material.opacity = clamp(1.2 - distanceToPlayer / 26, 0.15, 1)
    void this.animTime
  }

  dispose(): void {
    this.model.dispose()
    this.label.material.map?.dispose()
    this.label.material.dispose()
    this.root.removeFromParent()
  }
}

function makeNameplate(name: string, role: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = 'rgba(12,10,18,0.55)'
  roundRect(ctx, 96, 26, 320, 62, 14)
  ctx.fill()
  ctx.strokeStyle = 'rgba(214,180,110,0.55)'
  ctx.lineWidth = 2
  roundRect(ctx, 96, 26, 320, 62, 14)
  ctx.stroke()
  ctx.font = '600 34px "Segoe UI", system-ui, sans-serif'
  ctx.fillStyle = '#f4e9d2'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, 256, 50)
  ctx.font = '500 20px "Segoe UI", system-ui, sans-serif'
  ctx.fillStyle = '#c9b48a'
  ctx.fillText(role.toUpperCase(), 256, 76)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: true })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(2.4, 0.6, 1)
  return sprite
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function makeQuestMarkerMaterial(label: string, color: string): THREE.SpriteMaterial {
  const canvas = document.createElement('canvas')
  canvas.width = 96
  canvas.height = 96
  const ctx = canvas.getContext('2d')!
  ctx.beginPath()
  ctx.arc(48, 48, 38, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(12, 10, 18, 0.9)'
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 6
  ctx.stroke()
  ctx.fillStyle = color
  ctx.font = '700 56px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, 48, 49)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false, toneMapped: false })
}
