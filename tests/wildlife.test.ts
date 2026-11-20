import { describe, expect, it } from 'vitest'
import { WILDLIFE_ASSETS } from '../src/game/world/wildlife'

describe('fauna ambiente 3D', () => {
  it('usa modelos GLB CC0 reais e URLs fixas do pack Gobkit', () => {
    expect(Object.keys(WILDLIFE_ASSETS).sort()).toEqual(['corgi', 'redPanda', 'rhino'])
    for (const asset of Object.values(WILDLIFE_ASSETS)) {
      expect(asset.url).toMatch(/^https:\/\/raw\.githubusercontent\.com\/Ariescar\/gobkit-free-assets\/main\/animal\/.+\.glb$/)
      expect(asset.height).toBeGreaterThan(0.5)
      expect(asset.height).toBeLessThan(2)
    }
  })

  it('mantém nomes legíveis para logs e ferramentas de depuração', () => {
    expect(WILDLIFE_ASSETS.corgi.label).toBe('Corgi')
    expect(WILDLIFE_ASSETS.redPanda.label).toBe('Panda-vermelho')
    expect(WILDLIFE_ASSETS.rhino.label).toBe('Rinoceronte')
  })
})
