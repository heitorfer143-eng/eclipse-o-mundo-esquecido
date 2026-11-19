import * as THREE from 'three'
import type { BiomeId } from '../data/types'
import type { Quality } from '../../engine/save'

const BIOME_GLOW: Record<BiomeId, string> = {
  floresta: '#b8e8a2',
  'floresta-densa': '#7fdbbd',
  planicie: '#f3d58d',
  pantano: '#a4d88c',
  deserto: '#ffc27c',
  neve: '#a4dcff',
  montanha: '#d0bdff',
  vulcanico: '#ff9b70',
  cinzas: '#ffc0a0',
  praia: '#80e2e4',
  ilha: '#80e2e4',
  oceano: '#84bcff',
}

type Mote = { phase: number; radius: number; height: number; speed: number; drift: number }

/** Low-cost Aether motes around the player and a handcrafted-feeling floating relic at the story start. */
export class AetherVfx {
  private readonly motes: THREE.Points
  private readonly motePositions: Float32Array
  private readonly moteGeometry: THREE.BufferGeometry
  private readonly moteMaterial: THREE.PointsMaterial
  private readonly moteData: Mote[] = []
  private readonly follow = new THREE.Group()
  private readonly relic = new THREE.Group()
  private readonly halo: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>
  private readonly fallback: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshStandardMaterial>
  private readonly color = new THREE.Color()
  private currentBiome: BiomeId | null = null
  private time = 0
  private readonly count: number
  private relicBaseY = 0

  constructor(scene: THREE.Scene, seed: number, quality: Quality, relicModel?: THREE.Object3D) {
    const touchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    this.count = quality === 'low' ? 16 : touchDevice ? 28 : quality === 'medium' ? 36 : 48
    this.motePositions = new Float32Array(this.count * 3)
    this.moteGeometry = new THREE.BufferGeometry()
    this.moteGeometry.setAttribute('position', new THREE.BufferAttribute(this.motePositions, 3).setUsage(THREE.DynamicDrawUsage))
    this.moteGeometry.setDrawRange(0, this.count)
    this.moteMaterial = new THREE.PointsMaterial({
      color: '#ffffff',
      map: createGlowTexture(),
      size: 0.42,
      transparent: true,
      opacity: 0.52,
      alphaTest: 0.015,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
    this.motes = new THREE.Points(this.moteGeometry, this.moteMaterial)
    this.motes.frustumCulled = false
    this.follow.add(this.motes)
    scene.add(this.follow)

    for (let i = 0; i < this.count; i += 1) {
      const phase = seeded(seed + i * 97)
      this.moteData.push({
        phase: phase * Math.PI * 2,
        radius: 2.5 + seeded(seed + i * 193 + 7) * 8.5,
        height: 0.55 + seeded(seed + i * 283 + 13) * 3.2,
        speed: 0.16 + seeded(seed + i * 389 + 19) * 0.28,
        drift: 0.25 + seeded(seed + i * 491 + 23) * 0.65,
      })
    }

    this.relic.name = 'Fragmento de Aether'
    this.fallback = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.55, 0),
      new THREE.MeshStandardMaterial({ color: '#83d8f0', emissive: '#2788bb', emissiveIntensity: 1.1, metalness: 0.22, roughness: 0.26 }),
    )
    this.fallback.material.transparent = true
    this.fallback.material.opacity = 0.86
    this.relic.add(this.fallback)
    this.halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.76, 0.025, 6, 40),
      new THREE.MeshBasicMaterial({ color: '#ffd889', transparent: true, opacity: 0.62, blending: THREE.AdditiveBlending, depthWrite: false }),
    )
    this.halo.rotation.x = Math.PI / 2
    this.halo.position.y = -0.18
    this.relic.add(this.halo)
    scene.add(this.relic)
    this.loadModel(relicModel)
    this.relicBaseY = this.relic.position.y
  }

  setRelicAnchor(position: THREE.Vector3): void {
    this.relic.position.copy(position)
    this.relicBaseY = position.y
  }

  update(dt: number, player: THREE.Vector3, biome: BiomeId, night: number): void {
    const step = Math.min(0.08, Math.max(0, dt))
    this.time += step
    this.follow.position.set(player.x, player.y, player.z)
    if (biome !== this.currentBiome) {
      this.currentBiome = biome
      this.color.set(BIOME_GLOW[biome] ?? '#b8e8a2')
      this.moteMaterial.color.copy(this.color)
    }
    this.moteMaterial.opacity = 0.3 + Math.max(0, Math.min(1, night)) * 0.45
    for (let i = 0; i < this.moteData.length; i += 1) {
      const mote = this.moteData[i]
      const angle = mote.phase + this.time * mote.speed
      const wobble = Math.sin(this.time * (0.7 + mote.drift) + mote.phase) * mote.drift
      const index = i * 3
      this.motePositions[index] = Math.cos(angle) * mote.radius + Math.sin(this.time * 0.31 + mote.phase) * 0.28
      this.motePositions[index + 1] = mote.height + wobble
      this.motePositions[index + 2] = Math.sin(angle * 0.83) * mote.radius
    }
    this.moteGeometry.attributes.position.needsUpdate = true
    this.relic.rotation.y += step * 0.22
    this.relic.position.y = this.relicBaseY + Math.sin(this.time * 1.25) * 0.13
    this.halo.rotation.z = Math.sin(this.time * 0.56) * 0.12
    this.halo.material.opacity = 0.38 + (0.5 + Math.sin(this.time * 1.8) * 0.5) * 0.32
    this.fallback.rotation.y -= step * 0.38
    this.fallback.rotation.x = Math.sin(this.time * 0.65) * 0.14
  }

  private loadModel(source?: THREE.Object3D): void {
    if (!source) return
    const model = source.clone(true)
    const bounds = new THREE.Box3().setFromObject(model)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    bounds.getSize(size)
    bounds.getCenter(center)
    const extent = Math.max(size.x, size.y, size.z)
    if (!Number.isFinite(extent) || extent <= 0) return
    model.position.sub(center)
    const normalized = new THREE.Group()
    normalized.scale.setScalar(0.9 / extent)
    normalized.add(model)
    model.traverse(node => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = false
        node.receiveShadow = false
      }
    })
    this.relic.remove(this.fallback)
    this.fallback.geometry.dispose()
    this.fallback.material.dispose()
    this.relic.add(normalized)
  }
}

function seeded(value: number): number {
  const sine = Math.sin(value * 0.017453292519943295) * 43758.5453123
  return sine - Math.floor(sine)
}

function createGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const context = canvas.getContext('2d')!
  const glow = context.createRadialGradient(32, 32, 0, 32, 32, 32)
  glow.addColorStop(0, 'rgba(255,255,255,1)')
  glow.addColorStop(0.18, 'rgba(255,255,255,0.88)')
  glow.addColorStop(0.52, 'rgba(255,255,255,0.32)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = glow
  context.fillRect(0, 0, 64, 64)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
