import * as THREE from 'three'
import type { NpcDef } from '../data/types'
import { clamp, dampAngle } from '../core/math'
import { CharacterModel, type Appearance } from './character'
import { HUMANOID_VISUAL_SCALE } from './externalModels'
import { characterModelUrlFor } from './characterAssets'
import { npcAppearanceFor } from './npcAppearance'
import { resolveCircle, type Collider } from '../world/collision'

const QUEST_MARKER_MATERIALS = {
  offer: makeQuestMarkerMaterial('!', '#f3c65b'),
  turnIn: makeQuestMarkerMaterial('?', '#7fe0a2'),
}

/** A townsperson with a local role-specific model, floating nameplate and a small idle routine. */
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
    const look = npcAppearanceFor(def)
    const appearance: Partial<Appearance> = {
      skin: look.materials.skin ?? '#d0a070',
      cloth: look.materials.shirt ?? def.colors.body,
      clothAccent: look.materials.pants ?? def.colors.accent,
      leather: look.materials.belt ?? '#4b3a26',
      hair: look.materials.hair ?? '#5a4028',
    }
    const modelId = look.model === 'paladin' ? 'Paladin'
      : look.model === 'soldier' || look.model === 'civilian' ? 'Soldier'
        : look.model === 'barbarian' ? 'Barbarian'
          : look.model === 'mage' ? 'Mage'
            : look.model === 'rogue' ? 'Rogue' : 'Rogue_Hooded'
    const modelUrl = characterModelUrlFor(modelId, look.armored)
    this.model = new CharacterModel(appearance, modelUrl, Math.PI, modelId, look.materials)
    this.model.setAuraEnabled(false)
    this.model.root.scale.multiplyScalar(look.scale)
    this.root.add(this.model.root)
    this.position.set(x, groundY, z)
    this.home = this.position.clone()
    this.target.copy(this.position)
    this.facing = facing
    this.root.position.copy(this.position)
    this.root.rotation.y = facing

    this.label = makeNameplate(def.name, def.role)
    this.label.position.y = 2.25 * HUMANOID_VISUAL_SCALE * look.scale
    this.root.add(this.label)
    this.offerMarker = new THREE.Sprite(QUEST_MARKER_MATERIALS.offer)
    this.turnInMarker = new THREE.Sprite(QUEST_MARKER_MATERIALS.turnIn)
    for (const marker of [this.offerMarker, this.turnInMarker]) {
      marker.position.set(0, 2.35 * look.scale, 0)
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
