import * as THREE from 'three'
import type { EnemyColors, EnemyModel } from '../data/types'

export type EnemyVisual = {
  root: THREE.Group
  body: THREE.Group
  head?: THREE.Object3D
  armL?: THREE.Object3D
  armR?: THREE.Object3D
  legL?: THREE.Object3D
  legR?: THREE.Object3D
  wings: THREE.Object3D[]
  /** Approximate total height in metres (before per-type scale). */
  height: number
  radius: number
  materials: THREE.MeshStandardMaterial[]
}

type Ctx = {
  group: THREE.Group
  body: THREE.Group
  materials: THREE.MeshStandardMaterial[]
  bodyMat: THREE.MeshStandardMaterial
  accentMat: THREE.MeshStandardMaterial
  glowMat: THREE.MeshStandardMaterial
}

const GEO = new Map<string, THREE.BufferGeometry>()
function geo(key: string, build: () => THREE.BufferGeometry): THREE.BufferGeometry {
  const cached = GEO.get(key)
  if (cached) return cached
  const created = build()
  GEO.set(key, created)
  return created
}

const boxGeo = (w: number, h: number, d: number) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d))
const sphereGeo = (r: number, seg = 8) => geo(`s${r},${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(4, Math.round(seg * 0.7))))
const cylGeo = (rt: number, rb: number, h: number, seg = 6) => geo(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg))
const coneGeo = (r: number, h: number, seg = 6) => geo(`k${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg))

function add(ctx: Ctx, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, scale?: [number, number, number]): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(x, y, z)
  mesh.rotation.set(rx, ry, rz)
  if (scale) mesh.scale.set(scale[0], scale[1], scale[2])
  mesh.castShadow = true
  mesh.receiveShadow = false
  ctx.body.add(mesh)
  return mesh
}

function limb(ctx: Ctx, material: THREE.Material, x: number, y: number, z: number, length: number, radius: number): THREE.Group {
  const pivot = new THREE.Group()
  pivot.position.set(x, y, z)
  const mesh = new THREE.Mesh(cylGeo(radius, radius * 0.85, length, 6), material)
  mesh.position.y = -length / 2
  mesh.castShadow = true
  pivot.add(mesh)
  ctx.body.add(pivot)
  return pivot
}

/**
 * Builds a stylised creature from primitives. Each archetype gets its own silhouette so the 30
 * enemy types read differently on screen even though they share a small set of rigs.
 */
export function buildEnemyVisual(model: EnemyModel, colors: EnemyColors, scale = 1): EnemyVisual {
  const root = new THREE.Group()
  const body = new THREE.Group()
  root.add(body)
  const materials: THREE.MeshStandardMaterial[] = []
  const make = (color: string, emissive = '#000000', intensity = 0) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.08, flatShading: true, emissive: new THREE.Color(emissive), emissiveIntensity: intensity })
    materials.push(material)
    return material
  }
  const ctx: Ctx = {
    group: root,
    body,
    materials,
    bodyMat: make(colors.body),
    accentMat: make(colors.accent),
    glowMat: make(colors.glow ?? '#ffb347', colors.glow ?? '#ffb347', 2.4),
  }
  let height = 1.8
  let radius = 0.45
  let head: THREE.Object3D | undefined
  let armL: THREE.Object3D | undefined
  let armR: THREE.Object3D | undefined
  let legL: THREE.Object3D | undefined
  let legR: THREE.Object3D | undefined
  const wings: THREE.Object3D[] = []

  switch (model) {
    case 'lobo': {
      add(ctx, boxGeo(0.55, 0.55, 1.25), ctx.bodyMat, 0, 0.78, 0)
      add(ctx, boxGeo(0.42, 0.42, 0.42), ctx.bodyMat, 0, 0.92, -0.72)
      add(ctx, coneGeo(0.2, 0.42, 4), ctx.bodyMat, 0, 0.92, -1.02, -Math.PI / 2)
      add(ctx, coneGeo(0.09, 0.26, 4), ctx.accentMat, -0.15, 1.18, -0.68)
      add(ctx, coneGeo(0.09, 0.26, 4), ctx.accentMat, 0.15, 1.18, -0.68)
      add(ctx, sphereGeo(0.055, 6), ctx.glowMat, -0.13, 1.0, -0.9)
      add(ctx, sphereGeo(0.055, 6), ctx.glowMat, 0.13, 1.0, -0.9)
      add(ctx, coneGeo(0.12, 0.7, 5), ctx.bodyMat, 0, 0.85, 0.8, Math.PI / 2.4)
      legL = limb(ctx, ctx.bodyMat, -0.22, 0.55, -0.45, 0.55, 0.09)
      legR = limb(ctx, ctx.bodyMat, 0.22, 0.55, -0.45, 0.55, 0.09)
      limb(ctx, ctx.bodyMat, -0.22, 0.55, 0.45, 0.55, 0.09)
      limb(ctx, ctx.bodyMat, 0.22, 0.55, 0.45, 0.55, 0.09)
      height = 1.35
      radius = 0.6
      break
    }
    case 'esqueleto':
    case 'mumia': {
      const bone = model === 'mumia' ? ctx.bodyMat : make('#d9d2bb')
      add(ctx, cylGeo(0.11, 0.13, 0.75, 6), bone, 0, 1.15, 0)
      add(ctx, boxGeo(0.42, 0.16, 0.22), model === 'mumia' ? ctx.accentMat : bone, 0, 1.42, 0)
      add(ctx, sphereGeo(0.17, 8), model === 'mumia' ? ctx.accentMat : bone, 0, 1.68, 0)
      add(ctx, sphereGeo(0.045, 6), ctx.glowMat, -0.07, 1.7, -0.14)
      add(ctx, sphereGeo(0.045, 6), ctx.glowMat, 0.07, 1.7, -0.14)
      armL = limb(ctx, bone, -0.26, 1.4, 0, 0.72, 0.06)
      armR = limb(ctx, bone, 0.26, 1.4, 0, 0.72, 0.06)
      legL = limb(ctx, bone, -0.12, 0.78, 0, 0.78, 0.07)
      legR = limb(ctx, bone, 0.12, 0.78, 0, 0.78, 0.07)
      add(ctx, boxGeo(0.06, 1.0, 0.14), make('#aeb6c2', '#000000', 0), 0.34, 1.0, -0.18, 0.3)
      add(ctx, boxGeo(0.22, 0.3, 0.04), ctx.accentMat, -0.36, 1.1, -0.1)
      height = 1.9
      radius = 0.42
      break
    }
    case 'goblin':
    case 'diabrete': {
      const small = model === 'diabrete'
      add(ctx, sphereGeo(0.34, 8), ctx.bodyMat, 0, 0.85, 0)
      add(ctx, sphereGeo(0.27, 8), ctx.bodyMat, 0, 1.3, 0, 0, 0, 0, [1, 1.1, 1])
      add(ctx, coneGeo(0.11, 0.3, 4), ctx.accentMat, -0.24, 1.42, 0, 0, 0, 0.6)
      add(ctx, coneGeo(0.11, 0.3, 4), ctx.accentMat, 0.24, 1.42, 0, 0, 0, -0.6)
      add(ctx, sphereGeo(0.05, 6), ctx.glowMat, -0.1, 1.32, -0.22)
      add(ctx, sphereGeo(0.05, 6), ctx.glowMat, 0.1, 1.32, -0.22)
      armL = limb(ctx, ctx.bodyMat, -0.32, 1.05, 0, 0.55, 0.075)
      armR = limb(ctx, ctx.bodyMat, 0.32, 1.05, 0, 0.55, 0.075)
      legL = limb(ctx, ctx.accentMat, -0.14, 0.6, 0, 0.58, 0.08)
      legR = limb(ctx, ctx.accentMat, 0.14, 0.6, 0, 0.58, 0.08)
      add(ctx, cylGeo(0.05, 0.07, 0.7, 5), ctx.accentMat, 0.38, 0.9, -0.2, 0.4)
      if (small) {
        const wingL = new THREE.Mesh(boxGeo(0.5, 0.02, 0.34), ctx.accentMat)
        wingL.position.set(-0.3, 1.2, 0.15)
        wingL.rotation.z = 0.5
        const wingR = wingL.clone()
        wingR.position.x = 0.3
        wingR.rotation.z = -0.5
        ctx.body.add(wingL, wingR)
        wings.push(wingL, wingR)
      }
      height = small ? 1.35 : 1.65
      radius = small ? 0.35 : 0.45
      break
    }
    case 'golem':
    case 'elemental': {
      if (model === 'elemental') {
        add(ctx, sphereGeo(0.45, 10), ctx.glowMat, 0, 1.25, 0)
        for (let i = 0; i < 6; i += 1) {
          const a = (i / 6) * Math.PI * 2
          add(ctx, new THREE.OctahedronGeometry(0.2, 0), ctx.accentMat, Math.cos(a) * 0.85, 1.25 + Math.sin(a * 2) * 0.4, Math.sin(a) * 0.85)
        }
        add(ctx, coneGeo(0.4, 0.9, 6), ctx.bodyMat, 0, 0.5, 0)
        height = 1.9
        radius = 0.55
        break
      }
      add(ctx, boxGeo(0.95, 1.0, 0.7), ctx.bodyMat, 0, 1.45, 0)
      add(ctx, boxGeo(0.6, 0.45, 0.55), ctx.bodyMat, 0, 2.2, 0)
      add(ctx, new THREE.OctahedronGeometry(0.18, 0), ctx.glowMat, 0, 1.5, -0.4)
      add(ctx, sphereGeo(0.07, 6), ctx.glowMat, -0.16, 2.24, -0.26)
      add(ctx, sphereGeo(0.07, 6), ctx.glowMat, 0.16, 2.24, -0.26)
      armL = limb(ctx, ctx.bodyMat, -0.62, 1.8, 0, 1.0, 0.19)
      armR = limb(ctx, ctx.bodyMat, 0.62, 1.8, 0, 1.0, 0.19)
      legL = limb(ctx, ctx.accentMat, -0.28, 0.95, 0, 0.9, 0.22)
      legR = limb(ctx, ctx.accentMat, 0.28, 0.95, 0, 0.9, 0.22)
      for (let i = 0; i < 4; i += 1) add(ctx, new THREE.OctahedronGeometry(0.14, 0), ctx.accentMat, (i - 1.5) * 0.3, 2.6, 0.1)
      height = 2.7
      radius = 0.75
      break
    }
    case 'dragao': {
      add(ctx, boxGeo(1.0, 0.85, 2.2), ctx.bodyMat, 0, 1.7, 0)
      add(ctx, cylGeo(0.3, 0.42, 1.1, 7), ctx.bodyMat, 0, 2.3, -1.15, 0.5)
      add(ctx, boxGeo(0.55, 0.45, 0.95), ctx.bodyMat, 0, 2.75, -1.75)
      add(ctx, coneGeo(0.16, 0.4, 4), ctx.accentMat, -0.2, 2.95, -1.85, -0.4)
      add(ctx, coneGeo(0.16, 0.4, 4), ctx.accentMat, 0.2, 2.95, -1.85, -0.4)
      add(ctx, sphereGeo(0.08, 6), ctx.glowMat, -0.18, 2.82, -2.1)
      add(ctx, sphereGeo(0.08, 6), ctx.glowMat, 0.18, 2.82, -2.1)
      add(ctx, coneGeo(0.32, 1.5, 6), ctx.bodyMat, 0, 1.55, 1.5, Math.PI / 2.1)
      for (const side of [-1, 1]) {
        const wing = new THREE.Group()
        wing.position.set(side * 0.5, 2.1, 0)
        const membrane = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.4, 3), ctx.accentMat)
        membrane.rotation.set(Math.PI / 2, 0, side * 0.4)
        membrane.position.set(side * 1.1, 0.2, 0.2)
        membrane.scale.set(1, 1, 0.12)
        membrane.castShadow = true
        wing.add(membrane)
        ctx.body.add(wing)
        wings.push(wing)
      }
      armL = limb(ctx, ctx.bodyMat, -0.55, 1.8, -0.7, 0.9, 0.16)
      armR = limb(ctx, ctx.bodyMat, 0.55, 1.8, -0.7, 0.9, 0.16)
      legL = limb(ctx, ctx.accentMat, -0.38, 1.35, 0.5, 1.0, 0.2)
      legR = limb(ctx, ctx.accentMat, 0.38, 1.35, 0.5, 1.0, 0.2)
      height = 3.2
      radius = 1.2
      break
    }
    case 'cavaleiro': {
      add(ctx, boxGeo(0.62, 0.85, 0.42), ctx.bodyMat, 0, 1.35, 0)
      add(ctx, boxGeo(0.5, 0.3, 0.42), ctx.accentMat, 0, 0.9, 0)
      add(ctx, sphereGeo(0.22, 8), ctx.bodyMat, 0, 1.95, 0)
      add(ctx, boxGeo(0.26, 0.12, 0.3), ctx.accentMat, 0, 1.92, -0.12)
      add(ctx, sphereGeo(0.035, 6), ctx.glowMat, -0.08, 1.96, -0.2)
      add(ctx, sphereGeo(0.035, 6), ctx.glowMat, 0.08, 1.96, -0.2)
      armL = limb(ctx, ctx.bodyMat, -0.4, 1.65, 0, 0.75, 0.1)
      armR = limb(ctx, ctx.bodyMat, 0.4, 1.65, 0, 0.75, 0.1)
      legL = limb(ctx, ctx.accentMat, -0.16, 1.0, 0, 0.85, 0.1)
      legR = limb(ctx, ctx.accentMat, 0.16, 1.0, 0, 0.85, 0.1)
      add(ctx, boxGeo(0.06, 1.25, 0.16), make('#c3c9d4', '#000000', 0), 0.45, 1.05, -0.2, 0.2)
      add(ctx, boxGeo(0.42, 0.55, 0.06), ctx.accentMat, -0.42, 1.2, -0.12)
      add(ctx, new THREE.ConeGeometry(0.3, 0.7, 4), ctx.accentMat, 0, 1.9, 0.3, 0.2)
      height = 2.05
      radius = 0.45
      break
    }
    case 'gigante':
    case 'yeti':
    case 'troll': {
      const fur = model === 'yeti'
      add(ctx, boxGeo(1.3, 1.3, 0.9), ctx.bodyMat, 0, 2.0, 0)
      add(ctx, sphereGeo(0.42, 8), ctx.bodyMat, 0, 2.95, 0)
      add(ctx, sphereGeo(0.07, 6), ctx.glowMat, -0.16, 3.0, -0.36)
      add(ctx, sphereGeo(0.07, 6), ctx.glowMat, 0.16, 3.0, -0.36)
      if (model === 'troll') add(ctx, coneGeo(0.12, 0.4, 4), ctx.accentMat, 0, 3.25, -0.1)
      if (fur) for (let i = 0; i < 8; i += 1) add(ctx, sphereGeo(0.28, 6), ctx.accentMat, (Math.random() - 0.5) * 1.2, 1.6 + Math.random() * 1.2, (Math.random() - 0.5) * 0.8)
      armL = limb(ctx, ctx.bodyMat, -0.85, 2.5, 0, 1.35, 0.24)
      armR = limb(ctx, ctx.bodyMat, 0.85, 2.5, 0, 1.35, 0.24)
      legL = limb(ctx, ctx.accentMat, -0.35, 1.35, 0, 1.2, 0.28)
      legR = limb(ctx, ctx.accentMat, 0.35, 1.35, 0, 1.2, 0.28)
      add(ctx, cylGeo(0.12, 0.2, 2.2, 6), ctx.accentMat, 1.0, 1.6, -0.2, 0.2)
      height = 3.4
      radius = 0.9
      break
    }
    case 'espectro': {
      add(ctx, coneGeo(0.62, 2.0, 7), ctx.bodyMat, 0, 1.35, 0)
      add(ctx, sphereGeo(0.28, 8), ctx.accentMat, 0, 2.15, 0)
      add(ctx, sphereGeo(0.06, 6), ctx.glowMat, -0.1, 2.18, -0.22)
      add(ctx, sphereGeo(0.06, 6), ctx.glowMat, 0.1, 2.18, -0.22)
      for (let i = 0; i < 4; i += 1) {
        const a = (i / 4) * Math.PI * 2
        add(ctx, coneGeo(0.16, 0.9, 5), ctx.accentMat, Math.cos(a) * 0.45, 0.7, Math.sin(a) * 0.45, Math.PI)
      }
      height = 2.4
      radius = 0.55
      break
    }
    case 'aranha': {
      add(ctx, sphereGeo(0.42, 8), ctx.bodyMat, 0, 0.85, 0.2, 0, 0, 0, [1, 0.8, 1.2])
      add(ctx, sphereGeo(0.24, 8), ctx.accentMat, 0, 0.9, -0.45)
      for (let i = 0; i < 4; i += 1) add(ctx, sphereGeo(0.04, 6), ctx.glowMat, (i - 1.5) * 0.1, 0.98, -0.62)
      for (let i = 0; i < 8; i += 1) {
        const side = i < 4 ? -1 : 1
        const index = i % 4
        const leg = limb(ctx, ctx.bodyMat, side * 0.3, 0.85, -0.3 + index * 0.25, 0.9, 0.045)
        leg.rotation.z = side * (0.8 + index * 0.12)
        leg.rotation.x = -0.3 + index * 0.2
      }
      height = 1.2
      radius = 0.75
      break
    }
    case 'slime': {
      add(ctx, sphereGeo(0.6, 10), ctx.bodyMat, 0, 0.55, 0, 0, 0, 0, [1.15, 0.8, 1.15])
      add(ctx, sphereGeo(0.06, 6), ctx.glowMat, -0.18, 0.72, -0.5)
      add(ctx, sphereGeo(0.06, 6), ctx.glowMat, 0.18, 0.72, -0.5)
      add(ctx, sphereGeo(0.1, 6), ctx.accentMat, 0, 0.5, -0.56)
      height = 1.1
      radius = 0.6
      break
    }
    case 'harpia': {
      add(ctx, cylGeo(0.16, 0.22, 0.7, 6), ctx.bodyMat, 0, 1.35, 0)
      add(ctx, sphereGeo(0.2, 8), ctx.bodyMat, 0, 1.8, 0)
      add(ctx, coneGeo(0.07, 0.28, 4), ctx.accentMat, 0, 2.0, 0)
      add(ctx, sphereGeo(0.045, 6), ctx.glowMat, -0.08, 1.82, -0.16)
      add(ctx, sphereGeo(0.045, 6), ctx.glowMat, 0.08, 1.82, -0.16)
      for (const side of [-1, 1]) {
        const wing = new THREE.Group()
        wing.position.set(side * 0.2, 1.55, 0.05)
        const membrane = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.9, 3), ctx.accentMat)
        membrane.rotation.set(Math.PI / 2, 0, side * 0.5)
        membrane.position.set(side * 0.9, 0, 0)
        membrane.scale.z = 0.1
        wing.add(membrane)
        ctx.body.add(wing)
        wings.push(wing)
      }
      armL = limb(ctx, ctx.bodyMat, -0.24, 1.5, 0, 0.5, 0.05)
      armR = limb(ctx, ctx.bodyMat, 0.24, 1.5, 0, 0.5, 0.05)
      legL = limb(ctx, ctx.accentMat, -0.1, 1.0, 0, 0.6, 0.06)
      legR = limb(ctx, ctx.accentMat, 0.1, 1.0, 0, 0.6, 0.06)
      height = 2.1
      radius = 0.4
      break
    }
    case 'escorpiao': {
      add(ctx, sphereGeo(0.45, 8), ctx.bodyMat, 0, 0.6, 0.2, 0, 0, 0, [1, 0.7, 1.3])
      add(ctx, sphereGeo(0.26, 8), ctx.accentMat, 0, 0.65, -0.5)
      add(ctx, sphereGeo(0.05, 6), ctx.glowMat, -0.12, 0.7, -0.68)
      add(ctx, sphereGeo(0.05, 6), ctx.glowMat, 0.12, 0.7, -0.68)
      const tail = limb(ctx, ctx.accentMat, 0, 0.8, 0.7, 1.2, 0.12)
      tail.rotation.x = -1.1
      add(ctx, coneGeo(0.12, 0.3, 5), ctx.glowMat, 0, 1.55, 1.0, 0.4)
      for (const side of [-1, 1]) {
        const claw = limb(ctx, ctx.bodyMat, side * 0.45, 0.6, -0.45, 0.5, 0.08)
        claw.rotation.z = side * 1.1
      }
      for (let i = 0; i < 6; i += 1) {
        const side = i < 3 ? -1 : 1
        const leg = limb(ctx, ctx.bodyMat, side * 0.3, 0.55, -0.1 + (i % 3) * 0.3, 0.6, 0.04)
        leg.rotation.z = side * 1.0
      }
      height = 1.4
      radius = 0.7
      break
    }
    case 'morcego': {
      add(ctx, sphereGeo(0.24, 8), ctx.bodyMat, 0, 0.5, 0)
      add(ctx, sphereGeo(0.12, 6), ctx.bodyMat, 0, 0.72, -0.14)
      add(ctx, sphereGeo(0.035, 6), ctx.glowMat, -0.05, 0.74, -0.24)
      add(ctx, sphereGeo(0.035, 6), ctx.glowMat, 0.05, 0.74, -0.24)
      add(ctx, coneGeo(0.07, 0.2, 4), ctx.accentMat, -0.08, 0.86, -0.1)
      add(ctx, coneGeo(0.07, 0.2, 4), ctx.accentMat, 0.08, 0.86, -0.1)
      for (const side of [-1, 1]) {
        const wing = new THREE.Group()
        wing.position.set(side * 0.18, 0.55, 0)
        const membrane = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.0, 3), ctx.accentMat)
        membrane.rotation.set(Math.PI / 2, 0, side * 0.6)
        membrane.position.set(side * 0.5, 0, 0)
        membrane.scale.z = 0.08
        wing.add(membrane)
        ctx.body.add(wing)
        wings.push(wing)
      }
      height = 0.9
      radius = 0.35
      break
    }
    case 'treant': {
      add(ctx, cylGeo(0.45, 0.6, 2.2, 7), ctx.bodyMat, 0, 1.4, 0)
      add(ctx, sphereGeo(0.5, 8), ctx.accentMat, 0, 2.6, 0, 0, 0, 0, [1.6, 0.9, 1.6])
      add(ctx, sphereGeo(0.06, 6), ctx.glowMat, -0.16, 2.2, -0.5)
      add(ctx, sphereGeo(0.06, 6), ctx.glowMat, 0.16, 2.2, -0.5)
      armL = limb(ctx, ctx.bodyMat, -0.5, 2.2, 0, 1.3, 0.14)
      armR = limb(ctx, ctx.bodyMat, 0.5, 2.2, 0, 1.3, 0.14)
      legL = limb(ctx, ctx.bodyMat, -0.24, 0.7, 0, 0.7, 0.2)
      legR = limb(ctx, ctx.bodyMat, 0.24, 0.7, 0, 0.7, 0.2)
      for (let i = 0; i < 5; i += 1) add(ctx, sphereGeo(0.25, 6), ctx.accentMat, (Math.random() - 0.5) * 1.6, 2.8 + Math.random() * 0.6, (Math.random() - 0.5) * 1.4)
      height = 3.0
      radius = 0.7
      break
    }
    case 'serpente': {
      for (let i = 0; i < 7; i += 1) {
        const r = 0.34 - i * 0.03
        add(ctx, sphereGeo(r, 7), i === 0 ? ctx.accentMat : ctx.bodyMat, 0, 0.45 + Math.sin(i * 0.7) * 0.25, -i * 0.55)
      }
      add(ctx, boxGeo(0.34, 0.28, 0.5), ctx.accentMat, 0, 0.55, -3.5)
      add(ctx, sphereGeo(0.05, 6), ctx.glowMat, -0.1, 0.62, -3.68)
      add(ctx, sphereGeo(0.05, 6), ctx.glowMat, 0.1, 0.62, -3.68)
      height = 1.2
      radius = 0.7
      break
    }
  }

  root.scale.setScalar(scale)
  return { root, body, head, armL, armR, legL, legR, wings, height: height * scale, radius: radius * scale, materials }
}

export type EnemyVisualBounds = { width: number; height: number; depth: number }

/** Fit the actual generated silhouette to world-unit limits; gameplay radii follow the same scale. */
export function fitEnemyVisual(visual: EnemyVisual, maxHeight: number, maxFootprint: number): EnemyVisualBounds {
  const size = new THREE.Box3().setFromObject(visual.root).getSize(new THREE.Vector3())
  const footprint = Math.max(size.x, size.z)
  const fit = Math.min(1, maxHeight / Math.max(0.001, size.y), maxFootprint / Math.max(0.001, footprint))
  if (fit < 1) {
    visual.root.scale.multiplyScalar(fit)
    visual.radius *= fit
    size.multiplyScalar(fit)
  }
  visual.height = size.y
  return { width: size.x, height: size.y, depth: size.z }
}

export function disposeEnemyVisual(visual: EnemyVisual): void {
  visual.root.removeFromParent()
  // Geometries are cached and shared between enemies; only per-instance materials are disposed.
  for (const material of visual.materials) material.dispose()
}
