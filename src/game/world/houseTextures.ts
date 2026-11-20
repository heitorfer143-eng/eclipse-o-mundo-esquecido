import * as THREE from 'three'

export type HouseTextureSet = {
  wood: THREE.Texture
  stone: THREE.Texture
  plaster: THREE.Texture
  roof: THREE.Texture
}

const UV_TILES_PER_UNIT = 0.72

/**
 * Adds lightweight albedo maps to the untextured Shuriken house materials. Their meshes do not
 * ship UVs, so faces receive dominant-axis planar UVs once on the shared template before cloning.
 * Existing authored maps (including the CC0 fallback models) are always preserved.
 */
export function applyHouseTextures(model: THREE.Object3D, textures: HouseTextureSet): void {
  for (const texture of Object.values(textures)) {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = Math.min(texture.anisotropy || 1, 4)
    texture.needsUpdate = true
  }

  model.traverse(object => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const replacements = materials.map(material => {
      if (!(material instanceof THREE.MeshStandardMaterial) || material.map) return material
      const texture = textureForMaterial(material.name, textures)
      if (!texture) return material
      const replacement = material.clone()
      replacement.map = texture
      replacement.roughness = Math.max(replacement.roughness, 0.78)
      replacement.needsUpdate = true
      return replacement
    })
    if (replacements.every((material, index) => material === materials[index])) return
    mesh.material = Array.isArray(mesh.material) ? replacements : replacements[0]
    if (!mesh.geometry.getAttribute('uv')) mesh.geometry = addPlanarUvs(mesh.geometry)
  })
}

function textureForMaterial(name: string, textures: HouseTextureSet): THREE.Texture | null {
  const key = name.toLowerCase()
  if (/thatch|roof|shingle|paintred|paintorange/.test(key)) return textures.roof
  if (/wood|bark|timber/.test(key)) return textures.wood
  if (/stone|soil|plinth|brick/.test(key)) return textures.stone
  if (/cream|paint|plaster|wall/.test(key)) return textures.plaster
  return null
}

function addPlanarUvs(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const geometry = source.toNonIndexed()
  const positions = geometry.getAttribute('position')
  const uvs = new Float32Array(positions.count * 2)
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const ab = new THREE.Vector3()
  const ac = new THREE.Vector3()
  const normal = new THREE.Vector3()

  for (let i = 0; i + 2 < positions.count; i += 3) {
    a.fromBufferAttribute(positions, i)
    b.fromBufferAttribute(positions, i + 1)
    c.fromBufferAttribute(positions, i + 2)
    normal.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a)).normalize()
    const nx = Math.abs(normal.x)
    const ny = Math.abs(normal.y)
    const nz = Math.abs(normal.z)
    const plane: [number, number] = nx >= ny && nx >= nz ? [2, 1] : ny >= nz ? [0, 2] : [0, 1]
    for (let corner = 0; corner < 3; corner += 1) {
      const index = i + corner
      const u = positions.getX(index)
      const v = positions.getY(index)
      const w = positions.getZ(index)
      const coords = [u, v, w]
      uvs[index * 2] = coords[plane[0]] * UV_TILES_PER_UNIT
      uvs[index * 2 + 1] = coords[plane[1]] * UV_TILES_PER_UNIT
    }
  }
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  return geometry
}
