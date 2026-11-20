import * as THREE from 'three'
import type { Collider } from './collision'

export type HouseInterior = {
  root: THREE.Group
  floorY: number
  spawn: THREE.Vector3
  exit: THREE.Vector3
  colliders: Collider[]
  dispose: () => void
}

/** Small reusable interior for exterior-only house models; all coordinates are world-space. */
export function createHouseInterior(houseId: string): HouseInterior {
  const root = new THREE.Group()
  root.name = `interior-${houseId}`
  const floorY = 6
  const width = 8
  const depth = 7
  const wallHeight = 3.8
  const halfW = width / 2
  const halfD = depth / 2
  const materials = {
    floor: new THREE.MeshStandardMaterial({ color: '#806247', roughness: 0.92 }),
    wall: new THREE.MeshStandardMaterial({ color: '#d5c49d', roughness: 0.98 }),
    timber: new THREE.MeshStandardMaterial({ color: '#503b2c', roughness: 0.92 }),
    roof: new THREE.MeshStandardMaterial({ color: '#594638', roughness: 0.96, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({ color: '#75bbcc', emissive: '#245261', emissiveIntensity: 0.35, roughness: 0.3 }),
    cloth: new THREE.MeshStandardMaterial({ color: '#8a5051', roughness: 1 }),
    linen: new THREE.MeshStandardMaterial({ color: '#d6c9a5', roughness: 1 }),
    metal: new THREE.MeshStandardMaterial({ color: '#8b785e', metalness: 0.55, roughness: 0.6 }),
    ember: new THREE.MeshStandardMaterial({ color: '#ffb75d', emissive: '#df621d', emissiveIntensity: 1.1, roughness: 0.6 }),
  }
  const geometries = new Set<THREE.BufferGeometry>()
  const addBox = (name: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, material: THREE.Material, rotationY = 0): THREE.Mesh => {
    const geometry = new THREE.BoxGeometry(sx, sy, sz)
    geometries.add(geometry)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = name
    mesh.position.set(x, y, z)
    mesh.rotation.y = rotationY
    mesh.castShadow = true
    mesh.receiveShadow = true
    root.add(mesh)
    return mesh
  }

  addBox('floor-wood', 0, floorY - 0.14, 0, width, 0.28, depth, materials.floor)
  addBox('ceiling-beams', 0, floorY + wallHeight + 0.16, 0, width + 0.2, 0.24, depth + 0.2, materials.roof)
  addBox('wall-west', -halfW + 0.1, floorY + wallHeight / 2, 0, 0.2, wallHeight, depth, materials.wall)
  addBox('wall-east', halfW - 0.1, floorY + wallHeight / 2, 0, 0.2, wallHeight, depth, materials.wall)
  addBox('wall-back', 0, floorY + wallHeight / 2, halfD - 0.1, width, wallHeight, 0.2, materials.wall)
  // The front wall has a real opening; the player uses E at the inner threshold to leave.
  addBox('wall-front-left', -2.35, floorY + wallHeight / 2, -halfD + 0.1, 3.3, wallHeight, 0.2, materials.wall)
  addBox('wall-front-right', 2.35, floorY + wallHeight / 2, -halfD + 0.1, 3.3, wallHeight, 0.2, materials.wall)
  addBox('door-lintel', 0, floorY + 3.28, -halfD + 0.1, 1.5, 0.5, 0.22, materials.timber)
  addBox('door-leaf-open', -0.72, floorY + 1.15, -halfD + 0.32, 0.12, 2.3, 1.35, materials.timber, -0.62)
  addBox('door-threshold', 0, floorY + 0.03, -halfD + 0.1, 1.5, 0.08, 0.32, materials.timber)

  // Windows and warm furnishings make the room readable without introducing external assets.
  for (const z of [-1.65, 1.65]) {
    addBox(`window-frame-${z}`, -halfW + 0.25, floorY + 2.0, z, 0.16, 1.0, 1.2, materials.timber)
    addBox(`window-glass-${z}`, -halfW + 0.34, floorY + 2.0, z, 0.04, 0.72, 0.9, materials.glass)
  }
  addBox('bed-frame', -2.25, floorY + 0.32, 1.7, 1.65, 0.45, 2.35, materials.timber)
  addBox('bed-linen', -2.25, floorY + 0.62, 1.55, 1.55, 0.16, 1.85, materials.linen)
  addBox('bed-blanket', -2.25, floorY + 0.73, 2.05, 1.58, 0.14, 0.95, materials.cloth)
  addBox('table-top', 1.25, floorY + 1.08, 0.65, 1.75, 0.18, 1.2, materials.timber)
  for (const x of [0.58, 1.92]) for (const z of [0.22, 1.08]) {
    addBox(`table-leg-${x}-${z}`, x, floorY + 0.54, z, 0.14, 1.05, 0.14, materials.timber)
  }
  addBox('rug', 0.4, floorY + 0.012, -0.45, 2.8, 0.025, 1.6, materials.cloth)
  addBox('hearth-base', 2.85, floorY + 0.45, -2.05, 1.5, 0.9, 1.05, materials.timber)
  addBox('hearth-glow', 2.85, floorY + 0.62, -2.05, 0.78, 0.24, 0.56, materials.ember)
  const lamp = new THREE.PointLight('#ffbd70', 2.5, 12, 2)
  lamp.position.set(0.4, floorY + 3.25, 0.1)
  root.add(lamp)
  const fill = new THREE.HemisphereLight('#c7e7ff', '#372b21', 1.2)
  fill.position.set(0, floorY + 4, 0)
  root.add(fill)

  const colliders: Collider[] = [
    { kind: 'box', minX: -halfW, maxX: halfW, minZ: -halfD, maxZ: halfD, top: floorY, bottom: floorY - 0.28, solidTop: true, blocking: false },
    { kind: 'box', minX: -halfW, maxX: -halfW + 0.2, minZ: -halfD, maxZ: halfD, top: floorY + wallHeight, bottom: floorY, blocking: true },
    { kind: 'box', minX: halfW - 0.2, maxX: halfW, minZ: -halfD, maxZ: halfD, top: floorY + wallHeight, bottom: floorY, blocking: true },
    { kind: 'box', minX: -halfW, maxX: halfW, minZ: halfD - 0.2, maxZ: halfD, top: floorY + wallHeight, bottom: floorY, blocking: true },
    { kind: 'box', minX: -halfW, maxX: -0.75, minZ: -halfD, maxZ: -halfD + 0.2, top: floorY + wallHeight, bottom: floorY, blocking: true },
    { kind: 'box', minX: 0.75, maxX: halfW, minZ: -halfD, maxZ: -halfD + 0.2, top: floorY + wallHeight, bottom: floorY, blocking: true },
    { kind: 'box', minX: -halfW, maxX: halfW, minZ: -halfD, maxZ: halfD, top: floorY + wallHeight + 0.25, bottom: floorY + wallHeight, blocking: true },
    { kind: 'box', minX: -3.15, maxX: -1.35, minZ: 0.55, maxZ: 2.85, top: floorY + 0.85, bottom: floorY, blocking: true },
    { kind: 'box', minX: 0.3, maxX: 2.2, minZ: 0, maxZ: 1.3, top: floorY + 1.25, bottom: floorY, blocking: true },
  ]
  const exit = new THREE.Vector3(0, floorY + 0.08, -2.45)
  const spawn = new THREE.Vector3(0, floorY + 0.08, 0.65)

  return {
    root,
    floorY,
    spawn,
    exit,
    colliders,
    dispose: () => {
      root.removeFromParent()
      for (const geometry of geometries) geometry.dispose()
      for (const material of Object.values(materials)) material.dispose()
      lamp.dispose()
      // Light objects have no GPU buffers but clearing them releases scene references.
      fill.dispose()
      root.clear()
    },
  }
}
