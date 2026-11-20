import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { applyHouseTextures } from '../src/game/world/houseTextures'

function textureSet(): { wood: THREE.Texture; stone: THREE.Texture; plaster: THREE.Texture; roof: THREE.Texture } {
  return { wood: new THREE.Texture(), stone: new THREE.Texture(), plaster: new THREE.Texture(), roof: new THREE.Texture() }
}

describe('texturas das casas', () => {
  it('aplica mapas aos materiais Shuriken e cria UVs finitos quando ausentes', () => {
    const model = new THREE.Group()
    const wood = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 0.2), new THREE.MeshStandardMaterial({ name: 'Wood' }))
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 1), new THREE.MeshStandardMaterial({ name: 'ThatchDark' }))
    model.add(wood, roof)
    const textures = textureSet()

    applyHouseTextures(model, textures)

    expect((wood.material as THREE.MeshStandardMaterial).map).toBe(textures.wood)
    expect((roof.material as THREE.MeshStandardMaterial).map).toBe(textures.roof)
    for (const mesh of [wood, roof]) {
      const uv = mesh.geometry.getAttribute('uv')
      expect(uv).toBeDefined()
      for (let i = 0; i < uv.count; i += 1) {
        expect(Number.isFinite(uv.getX(i)) && Number.isFinite(uv.getY(i))).toBe(true)
      }
    }
  })

  it('preserva os mapas de textura e a geometria UV dos modelos alternativos', () => {
    const model = new THREE.Group()
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const originalMap = new THREE.Texture()
    const material = new THREE.MeshStandardMaterial({ name: 'Wood', map: originalMap })
    const mesh = new THREE.Mesh(geometry, material)
    model.add(mesh)
    applyHouseTextures(model, textureSet())

    expect(mesh.material).toBe(material)
    expect((mesh.material as THREE.MeshStandardMaterial).map).toBe(originalMap)
    expect(mesh.geometry).toBe(geometry)

    originalMap.dispose()
    material.dispose()
    geometry.dispose()
  })
})
