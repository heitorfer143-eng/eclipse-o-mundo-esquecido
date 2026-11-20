import { describe, expect, it } from 'vitest'
import { NPCS } from '../src/game/data/npcData'
import { CharacterModel, type AnimState } from '../src/game/entities/character'
import { npcAppearanceFor } from '../src/game/entities/npcAppearance'

describe('aparência Quaternius dos NPCs', () => {
  const appearances = NPCS.map(def => ({ def, look: npcAppearanceFor(def) }))

  it('distribui modelos locais de estilo low-poly e paletas válidas entre os NPCs', () => {
    const models = new Set(appearances.map(({ look }) => look.model))
    expect(models.size).toBeGreaterThanOrEqual(5)
    for (const model of ['civilian', 'soldier', 'paladin', 'barbarian', 'mage', 'rogue', 'rogue-hooded']) {
      expect(models.has(model as typeof appearances[number]['look']['model'])).toBe(true)
    }
    expect(appearances.length).toBeGreaterThan(0)
    for (const { look } of appearances) {
      expect(look.scale).toBeGreaterThan(0)
      expect(look.scale).toBeLessThanOrEqual(1)
      expect(look.materials.skin).toMatch(/^#[\da-f]{6}$/i)
      expect(look.materials.shirt).toMatch(/^#[\da-f]{6}$/i)
      expect(look.materials.pants).toMatch(/^#[\da-f]{6}$/i)
      expect('aura' in look).toBe(false)
    }
  })

  it('varia rosto e roupas, reservando as variantes armadas para guardas e capitão', () => {
    expect(new Set(appearances.map(({ look }) => look.materials.skin)).size).toBeGreaterThan(4)
    expect(new Set(appearances.map(({ look }) => look.materials.shirt)).size).toBeGreaterThan(5)
    expect(appearances.some(({ def, look }) => def.role !== 'guarda' && def.id !== 'capitao-ronan' && look.model === 'civilian')).toBe(true)
    expect(appearances.filter(({ def }) => def.role === 'guarda' && def.id !== 'capitao-ronan')
      .every(({ look }) => look.model === 'soldier' && look.armored)).toBe(true)

    const captain = appearances.find(({ def }) => def.id === 'capitao-ronan')
    expect(captain?.look.model).toBe('paladin')
    expect(captain?.look.materials.armor).toBe('#d4b04b')
  })

  it('mantém a aura desligada mesmo durante uma conjuração', () => {
    const model = new CharacterModel({}, '', 0, 'Survivor')
    const cast: AnimState = {
      mode: 'cast', speed: 0, actionTime: 0.2, actionDuration: 0.8,
      combo: 0, weapon: 'espada', charging: false,
    }
    model.setAuraEnabled(true)
    model.animate(1 / 60, cast)
    expect(model.root.getObjectByName('character-aura')?.visible).toBe(false)
    model.dispose()
  })
})
