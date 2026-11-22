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

export type TreeGeometrySet = { bark: THREE.BufferGeometry | null; foliage: THREE.BufferGeometry | null; natureLeaves: THREE.BufferGeometry | null }
const TREE_CACHE = new Map<TreeKind, TreeGeometrySet | null>()

const NATURE_LEAF_BOUNDS: readonly [number, number, number, number][] = [
  [400, 116, 615, 420], [673, 160, 850, 350], [166, 254, 420, 470],
  [610, 300, 874, 574], [92, 430, 320, 601], [315, 430, 590, 810],
  [670, 604, 910, 770], [119, 630, 330, 805], [370, 740, 540, 933],
]

/** Oak-only leaf cards address individual alpha-cut leaves in the supplied atlas. */
function natureLeafCardGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const uvs: number[] = []
  const addVertex = (point: THREE.Vector3, u: number, v: number): void => {
    positions.push(point.x, point.y, point.z)
    uvs.push(u, v)
  }
  for (let i = 0; i < 27; i += 1) {
    const [x0, y0, x1, y1] = NATURE_LEAF_BOUNDS[i % NATURE_LEAF_BOUNDS.length]
    const angle = i * 2.399963229728653
    const radius = 0.35 + ((i * 37) % 9) * 0.12
    const center = new THREE.Vector3(Math.cos(angle) * radius, 3.5 + ((i * 29) % 11) * 0.19, Math.sin(angle) * radius)
    const tilt = ((i % 5) - 2) * 0.11
    const axisX = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))
    const axisY = new THREE.Vector3(-Math.sin(angle) * tilt, 1, Math.cos(angle) * tilt).normalize()
    const width = 0.42 + (i % 4) * 0.07
    const height = 0.58 + (i % 3) * 0.09
    const lowerLeft = center.clone().addScaledVector(axisX, -width / 2).addScaledVector(axisY, -height / 2)
    const lowerRight = center.clone().addScaledVector(axisX, width / 2).addScaledVector(axisY, -height / 2)
    const upperRight = center.clone().addScaledVector(axisX, width / 2).addScaledVector(axisY, height / 2)
    const upperLeft = center.clone().addScaledVector(axisX, -width / 2).addScaledVector(axisY, height / 2)
    const u0 = (x0 + 2) / 1024
    const u1 = (x1 - 2) / 1024
    const vTop = 1 - (y0 + 2) / 1024
    const vBottom = 1 - (y1 - 2) / 1024
    addVertex(lowerLeft, u0, vBottom); addVertex(lowerRight, u1, vBottom); addVertex(upperRight, u1, vTop)
    addVertex(lowerLeft, u0, vBottom); addVertex(upperRight, u1, vTop); addVertex(upperLeft, u0, vTop)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()
  return geometry
}

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
    natureLeaves: kind === 'carvalho' ? natureLeafCardGeometry() : null,
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
  const verticalScale = [0.72, 0.6, 0.84][key]
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i)
    const y = position.getY(i)
    const z = position.getZ(i)
    // Detail-1 Icosahedra duplicate vertices per triangle; coordinate noise keeps shared
    // vertices aligned, preserving a watertight silhouette instead of making sharp spikes.
    const radius = 0.9 + 0.08 * Math.sin(x * 4.1 + y * 7.7 + z * 5.3 + key * 2.1)
    position.setXYZ(i, x * radius, y * radius * verticalScale, z * radius)
  }
  geo.computeVertexNormals()
  // Keep the diffuse atlas colors intact so the stone facets remain readable at gameplay distance.
  paint(geo, '#ffffff')
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
  const positions: number[] = []
  const uvs: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const addPoint = (point: THREE.Vector3, u: number, v: number): void => {
    positions.push(point.x, point.y, point.z)
    uvs.push(u, v)
    colors.push(1, 1, 1)
  }
  for (let i = 0; i < 6; i += 1) {
    const angle = i * 2.399963229728653
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))
    const side = new THREE.Vector3(-direction.z, 0, direction.x)
    const height = 0.82 + (i % 3) * 0.10
    const width = 0.17 + (i % 2) * 0.045
    const lean = direction.multiplyScalar(0.16 + (i % 3) * 0.025)
    const baseLeft = side.clone().multiplyScalar(-width / 2)
    const baseRight = side.clone().multiplyScalar(width / 2)
    const middleLeft = baseLeft.clone().multiplyScalar(0.52).addScaledVector(lean, 0.38).add(new THREE.Vector3(0, height * 0.56, 0))
    const middleRight = baseRight.clone().multiplyScalar(0.52).addScaledVector(lean, 0.38).add(new THREE.Vector3(0, height * 0.56, 0))
    const tip = lean.clone().add(new THREE.Vector3(0, height, 0))
    const first = positions.length / 3
    addPoint(baseLeft, 0.03, 1)
    addPoint(baseRight, 0.97, 1)
    addPoint(middleRight, 0.80, 0.46)
    addPoint(tip, 0.50, 0)
    addPoint(middleLeft, 0.20, 0.46)
    indices.push(first, first + 1, first + 2, first, first + 2, first + 4, first + 2, first + 3, first + 4)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  grassGeometryCache = geometry
  return grassGeometryCache
}

/** Vertex-coloured standard material shared by every instanced prop. */
export function propMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, flatShading: true })
}
