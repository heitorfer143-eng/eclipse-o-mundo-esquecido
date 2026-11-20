import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export type TreeKind = 'pinheiro' | 'carvalho' | 'morto' | 'palmeira' | 'cacto' | 'cogumelo' | 'nenhum'

/** Bake a flat colour into a geometry's vertex-colour attribute so parts can merge into one mesh. */
export function paint(geometry: THREE.BufferGeometry, color: THREE.ColorRepresentation): THREE.BufferGeometry {
  const c = new THREE.Color(color)
  const count = geometry.attributes.position.count
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i += 1) {
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}

function merge(parts: THREE.BufferGeometry[], uvMode?: 'bark' | 'foliage'): THREE.BufferGeometry {
  // Mixing indexed and non-indexed primitives breaks mergeGeometries, and UV sets differ between
  // cylinders and icosahedrons, so normalise everything to position/normal/color only.
  const normalized = parts.map(part => {
    const geometry = part.index ? part.toNonIndexed() : part.clone()
    geometry.deleteAttribute('uv')
    geometry.deleteAttribute('uv1')
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals()
    if (!geometry.getAttribute('color')) paint(geometry, '#ffffff')
    return geometry
  })
  const merged = mergeGeometries(normalized, false)
  if (!merged) throw new Error('failed to merge prop geometry')
  for (const geometry of normalized) geometry.dispose()
  merged.computeVertexNormals()
  if (uvMode) {
    const position = merged.getAttribute('position')
    const bounds = new THREE.Box3().setFromBufferAttribute(position as THREE.BufferAttribute)
    const size = bounds.getSize(new THREE.Vector3())
    const uv = new Float32Array(position.count * 2)
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i)
      const y = position.getY(i)
      const z = position.getZ(i)
      uv[i * 2] = uvMode === 'bark' ? Math.atan2(z, x) / (Math.PI * 2) + 0.5 : (x - bounds.min.x) / Math.max(0.001, size.x)
      uv[i * 2 + 1] = (y - bounds.min.y) / Math.max(0.001, size.y)
    }
    merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  }
  return merged
}

export type TreeGeometrySet = { bark: THREE.BufferGeometry | null; foliage: THREE.BufferGeometry | null }
const TREE_CACHE = new Map<TreeKind, TreeGeometrySet | null>()

/** Two merged, vertex-coloured parts per kind keep bark and leaves independently textured. */
export function treeGeometries(kind: TreeKind): TreeGeometrySet | null {
  const cached = TREE_CACHE.get(kind)
  if (cached !== undefined) return cached
  const barkParts: THREE.BufferGeometry[] = []
  const foliageParts: THREE.BufferGeometry[] = []
  if (kind === 'pinheiro') {
    barkParts.push(paint(new THREE.CylinderGeometry(0.18, 0.3, 4.2, 6).translate(0, 2.1, 0), '#4a3626'))
    for (let i = 0; i < 3; i += 1) {
      const r = 2.1 - i * 0.55
      const cone = new THREE.ConeGeometry(r, 2.6, 7).translate(0, 3.6 + i * 1.5, 0)
      foliageParts.push(paint(cone, i === 2 ? '#2f5d3a' : '#356b41'))
    }
  } else if (kind === 'carvalho') {
    barkParts.push(paint(new THREE.CylinderGeometry(0.3, 0.48, 3.2, 7).translate(0, 1.6, 0), '#5a4030'))
    foliageParts.push(paint(new THREE.IcosahedronGeometry(1.9, 0).translate(0, 4.3, 0), '#4c8a42'))
    foliageParts.push(paint(new THREE.IcosahedronGeometry(1.4, 0).translate(1.1, 3.6, 0.4), '#3f7a3a'))
    foliageParts.push(paint(new THREE.IcosahedronGeometry(1.25, 0).translate(-1.0, 3.9, -0.5), '#579a4b'))
  } else if (kind === 'morto') {
    barkParts.push(paint(new THREE.CylinderGeometry(0.16, 0.4, 4.4, 6).translate(0, 2.2, 0), '#3b3330'))
    const branch = (x: number, y: number, z: number, rx: number, rz: number, len: number) => {
      const b = new THREE.CylinderGeometry(0.07, 0.13, len, 5)
      b.rotateZ(rz)
      b.rotateX(rx)
      b.translate(x, y, z)
      return paint(b, '#443b36')
    }
    barkParts.push(branch(0.7, 3.1, 0, 0.5, -0.9, 2.2))
    barkParts.push(branch(-0.6, 2.5, 0.3, -0.4, 1.0, 1.9))
    barkParts.push(branch(0.2, 4.0, -0.5, 1.1, 0.2, 1.5))
  } else if (kind === 'palmeira') {
    const trunk = new THREE.CylinderGeometry(0.16, 0.3, 5.4, 6)
    trunk.rotateZ(0.12)
    barkParts.push(paint(trunk.translate(0.3, 2.7, 0), '#6b5334'))
    for (let i = 0; i < 7; i += 1) {
      const leaf = new THREE.ConeGeometry(0.42, 3.4, 4)
      leaf.rotateZ(Math.PI / 2.2)
      leaf.rotateY((i / 7) * Math.PI * 2)
      leaf.translate(Math.cos((i / 7) * Math.PI * 2) * 1.2, 5.2, Math.sin((i / 7) * Math.PI * 2) * 1.2)
      foliageParts.push(paint(leaf, i % 2 === 0 ? '#4f8f4a' : '#5da354'))
    }
  } else if (kind === 'cacto') {
    foliageParts.push(paint(new THREE.CylinderGeometry(0.42, 0.5, 3.2, 7).translate(0, 1.6, 0), '#5d8a4a'))
    const arm = new THREE.CylinderGeometry(0.22, 0.26, 1.3, 6)
    arm.rotateZ(Math.PI / 2)
    foliageParts.push(paint(arm.clone().translate(0.75, 2.1, 0), '#4f7a40'))
    foliageParts.push(paint(arm.clone().rotateZ(0).translate(-0.7, 1.6, 0), '#4f7a40'))
  } else if (kind === 'cogumelo') {
    barkParts.push(paint(new THREE.CylinderGeometry(0.3, 0.42, 1.8, 7).translate(0, 0.9, 0), '#e6dcc4'))
    foliageParts.push(paint(new THREE.SphereGeometry(1.35, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.7, 0), '#8a4f6b'))
  }
  if (!barkParts.length && !foliageParts.length) { TREE_CACHE.set(kind, null); return null }
  const geometry: TreeGeometrySet = {
    bark: barkParts.length ? merge(barkParts, 'bark') : null,
    foliage: foliageParts.length ? merge(foliageParts, 'foliage') : null,
  }
  TREE_CACHE.set(kind, geometry)
  return geometry
}

const ROCK_CACHE = new Map<number, THREE.BufferGeometry>()
export function rockGeometry(variant: number): THREE.BufferGeometry {
  const key = variant % 3
  const cached = ROCK_CACHE.get(key)
  if (cached) return cached
  const geo = new THREE.IcosahedronGeometry(1, key === 0 ? 0 : 1)
  const position = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < position.count; i += 1) {
    const n = 0.72 + ((i * 37 + key * 17) % 13) / 26
    position.setXYZ(i, position.getX(i) * n, position.getY(i) * n * 0.72, position.getZ(i) * n)
  }
  geo.computeVertexNormals()
  paint(geo, key === 2 ? '#6a6a72' : '#7d7a72')
  const uv = new Float32Array(position.count * 2)
  const bounds = new THREE.Box3().setFromBufferAttribute(position)
  const size = bounds.getSize(new THREE.Vector3())
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i)
    const y = position.getY(i)
    const z = position.getZ(i)
    uv[i * 2] = Math.atan2(z, x) / (Math.PI * 2) + 0.5
    uv[i * 2 + 1] = (y - bounds.min.y) / Math.max(0.001, size.y)
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  ROCK_CACHE.set(key, geo)
  return geo
}

let grassGeometryCache: THREE.BufferGeometry | null = null
export function grassGeometry(): THREE.BufferGeometry {
  if (grassGeometryCache) return grassGeometryCache
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 3; i += 1) {
    const blade = new THREE.ConeGeometry(0.09, 0.72, 3)
    blade.rotateZ((i - 1) * 0.3)
    blade.translate((i - 1) * 0.13, 0.36, (i % 2) * 0.1)
    parts.push(paint(blade, i === 1 ? '#8fbf5a' : '#6fa347'))
  }
  grassGeometryCache = merge(parts, 'foliage')
  return grassGeometryCache
}

/** Vertex-coloured standard material shared by every instanced prop. */
export function propMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, flatShading: true })
}
