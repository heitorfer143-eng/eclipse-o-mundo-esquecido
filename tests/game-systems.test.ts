import { describe, expect, it } from 'vitest'
import { parseSave, SAVE_KEY, SaveStore } from '../src/engine/save'
import { DEFAULT_CHARACTER_PROFILE, isCharacterNameValid } from '../src/game/data/characterProfile'
import { NPCS } from '../src/game/data/npcData'
import { QUESTS, questById } from '../src/game/data/questData'
import { DialogueRunner } from '../src/game/systems/dialogue'
import { Inventory } from '../src/game/systems/inventory'
import { QuestLog } from '../src/game/systems/quests'
import { SkillTree } from '../src/game/systems/skills'
import { Terrain } from '../src/game/world/terrain'

const samplePoints = [
  [-1420, -930],
  [-370, 640],
  [510, -1180],
  [980, 430],
  [1450, 1120],
] as const

describe('mundo procedural', () => {
  it('é determinístico para a mesma seed e varia entre seeds', () => {
    const first = new Terrain(731_029)
    const repeated = new Terrain(731_029)
    const other = new Terrain(9_104_663)
    const heights = (terrain: Terrain): number[] => samplePoints.map(([x, z]) => terrain.heightAt(x, z))

    expect(heights(repeated)).toEqual(heights(first))
    expect(heights(other)).not.toEqual(heights(first))
  })
})

describe('salvamento local', () => {
  it('preserva a seed própria da aventura ao reabrir o save', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
      removeItem: (key: string) => { values.delete(key) },
    }
    const store = new SaveStore(storage)
    const seed = 4_000_000_000

    store.saveGame({
      seed,
      position: [12, 28, -45],
      facing: 0.7,
      playtime: 61,
      timeOfDay: 0.42,
      progression: { level: 3, xp: 125, attributePoints: 0, skillPoints: 1, attributes: {} },
      inventory: { stacks: [], equipment: {}, gold: 15 },
      skills: {},
      quests: { tracked: 'principal-01', states: {} },
      discovered: [],
      openedChests: [],
      deaths: 0,
      kills: 2,
      createdAt: 1,
      updatedAt: 1,
    })

    expect(new SaveStore(storage).data.game?.seed).toBe(seed)
    const restored = new SaveStore(storage)
    restored.clearGame()
    expect(restored.data.game).toBeNull()
  })
  it('migra saves antigos e persiste com segurança o perfil do protagonista fora da aventura', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
      removeItem: (key: string) => { values.delete(key) },
    }
    const legacy = parseSave(JSON.stringify({ version: 2, game: null }))
    expect(legacy.profile).toEqual(DEFAULT_CHARACTER_PROFILE)

    const store = new SaveStore(storage)
    store.updateProfile({ name: 'Eira da Lua', modelId: 'Rogue_Hooded', auraColor: '#c094ff' })
    store.saveGame({
      seed: 7, position: [0, 40, 800], facing: 0, playtime: 0, timeOfDay: 0.32,
      progression: { level: 1, xp: 0, attributePoints: 0, skillPoints: 0, attributes: {} },
      inventory: { stacks: [], equipment: {}, gold: 0 }, skills: {},
      quests: { tracked: null, states: {} }, discovered: [], openedChests: [],
      deaths: 0, kills: 0, createdAt: 1, updatedAt: 1,
    })
    const restored = new SaveStore(storage)
    expect(restored.data.profile).toEqual({ name: 'Eira da Lua', modelId: 'Rogue_Hooded', auraColor: '#c094ff' })
    restored.clearGame()
    expect(new SaveStore(storage).data.game).toBeNull()
    expect(new SaveStore(storage).data.profile).toEqual({ name: 'Eira da Lua', modelId: 'Rogue_Hooded', auraColor: '#c094ff' })
    expect(isCharacterNameValid('Eira')).toBe(true)
    expect(isCharacterNameValid(' ')).toBe(false)

    values.set(SAVE_KEY, JSON.stringify({ version: 2, game: null, profile: { modelId: '<script>', auraColor: 'url(javascript:alert(1))' } }))
    expect(new SaveStore(storage).data.profile).toEqual(DEFAULT_CHARACTER_PROFILE)
  })
  it('normaliza posição com componentes Infinity, NaN e fora de limites, sem lançar', () => {
    const stored = JSON.stringify({ version: 2, game: { position: [Infinity, NaN, 1e999] } })
    const parsed = parseSave(stored)
    expect(parsed.game?.position).toEqual([0, 40, 800])

    const overflow = parseSave('{"version":2,"game":{"position":[1e999,-1e999,120000]}}')
    expect(overflow.game?.position).toEqual([0, 40, 100000])
    expect(() => parseSave('{"version":2,"game":{"position":[NaN,0,0]}}')).not.toThrow()
  })
  it('filtra pilhas e equipamento inválidos antes de SaveStore e Inventory.load', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
      removeItem: (key: string) => { values.delete(key) },
    }
    values.set(SAVE_KEY, JSON.stringify({ version: 2, game: {
      inventory: {
        stacks: [null, [], { id: 'id-inexistente', count: 3, plus: 0 },
          { id: 'pocao-vida-1', count: -4, plus: 99 },
          { id: 'mat-ferro', count: Infinity, plus: NaN },
          { id: 'comida-pao', count: 500, plus: -7 }],
        equipment: { arma: { id: 'mat-ferro', count: 4, plus: 9 }, anel1: { id: 'anel-safira', count: 8, plus: 9 }, desconhecido: { id: 'arma-espada-1', count: 1, plus: 0 } },
        gold: Infinity,
      },
      skills: { 'lamina-forca': Infinity, 'skill-desconhecida': 3 },
    } }))
    const store = new SaveStore(storage)
    const game = store.data.game!
    expect(game.inventory.stacks).toEqual([
      { id: 'pocao-vida-1', count: 1, plus: 5 },
      { id: 'mat-ferro', count: 1, plus: 0 },
      { id: 'comida-pao', count: 99, plus: 0 },
    ])
    expect(game.inventory.equipment).toMatchObject({ arma: null, anel1: { id: 'anel-safira', count: 1, plus: 5 } })
    expect(Object.keys(game.inventory.equipment).sort()).toEqual(['anel1', 'anel2', 'arma', 'armadura', 'botas', 'capacete', 'reliquia'].sort())
    expect(game.inventory.gold).toBe(0)
    expect(game.skills).toEqual({})

    const inventory = new Inventory()
    const skills = new SkillTree()
    expect(() => inventory.load(game.inventory)).not.toThrow()
    expect(() => skills.load(game.skills)).not.toThrow()
    expect(inventory.stacks).toHaveLength(3)
    expect(inventory.totalItems()).toBe(101)
    expect(inventory.equipment.anel1).toEqual({ id: 'anel-safira', count: 1, plus: 5 })
  })
  it('preserva pilhas válidas após entradas inválidas no início da lista', () => {
    const invalidPrefix = Array.from({ length: 42 }, () => null)
    const parsed = parseSave(JSON.stringify({ version: 2, game: { inventory: {
      stacks: [...invalidPrefix, { id: 'comida-pao', count: 2, plus: 0 }],
    } } }))
    expect(parsed.game?.inventory.stacks).toEqual([{ id: 'comida-pao', count: 2, plus: 0 }])
  })
  it('descarta estados de quest malformados e restringe progress aos objetivos conhecidos', () => {
    const objectiveId = questById('principal-01')!.objectives[0].id
    const stored = JSON.stringify({ version: 2, game: { quests: {
      tracked: 'quest-inexistente',
      states: {
        'principal-01': { status: 'ativa', progress: { [objectiveId]: 999, notified: 1, 'objetivo-inexistente': 4 } },
        'principal-02': { status: 'pronta', progress: { 'obj-p02-1': 2 } },
        'principal-03': null,
        'principal-04': [],
        'quest-inexistente': { status: 'concluida', progress: {} },
        'principal-05': { status: 'concluida', progress: { notified: 2 } },
      },
    } } })
    const parsed = parseSave(stored)
    expect(parsed.game?.quests).toEqual({
      tracked: 'principal-01',
      states: { 'principal-01': { status: 'ativa', progress: { [objectiveId]: 3, notified: 1 } }, 'principal-05': { status: 'concluida', progress: {} } },
    })
    const quests = new QuestLog()
    expect(() => quests.load(parsed.game!.quests)).not.toThrow()
    expect(quests.state('principal-01')).toEqual({ status: 'ativa', progress: { [objectiveId]: 3, notified: 1 } })
    expect(quests.state('principal-05')).toEqual({ status: 'concluida', progress: {} })
    expect(quests.states.has('principal-02')).toBe(false)
  })
})

describe('arco opcional da memória', () => {
  const level = 40

  function followNext(dialogue: DialogueRunner, next: string, quests: QuestLog): void {
    const index = dialogue.choices(quests, level).findIndex(choice => choice.next === next)
    expect(index, `o diálogo precisa ter uma rota para ${next}`).toBeGreaterThanOrEqual(0)
    dialogue.select(index, quests, level)
  }

  function acceptFromDialogue(dialogue: DialogueRunner, id: string, quests: QuestLog): void {
    const index = dialogue.choices(quests, level).findIndex(choice => choice.action === 'aceitar' && choice.quest === id)
    expect(index, `a oferta ${id} precisa estar visível no NPC`).toBeGreaterThanOrEqual(0)
    expect(dialogue.select(index, quests, level)).toMatchObject({ action: 'aceitar', quest: id })
    expect(quests.accept(id, level)).toBeNull()
  }

  function completeObjectives(quests: QuestLog, id: string): void {
    const quest = questById(id)
    expect(quest).toBeDefined()
    for (const objective of quest!.objectives) quests.progress(objective.kind, objective.target, objective.count)
    expect(quests.complete(id)).toEqual(quest!.rewards)
  }

  it('liga Vekh e Iara em três missões com pré-requisitos, objetivos e nós alcançáveis', () => {
    const quests = new QuestLog()
    const dialogue = new DialogueRunner()
    const iara = NPCS.find(npc => npc.id === 'iara')!
    const vekh = NPCS.find(npc => npc.id === 'eremita-vekh')!

    expect(QUESTS.filter(quest => /^secundaria-1[345]$/.test(quest.id))).toHaveLength(3)
    quests.states.set('principal-05', { status: 'concluida', progress: {} })
    dialogue.open(vekh, quests, level)
    followNext(dialogue, 'eco', quests)
    acceptFromDialogue(dialogue, 'secundaria-13', quests)
    completeObjectives(quests, 'secundaria-13')

    quests.states.set('principal-08', { status: 'concluida', progress: {} })
    dialogue.open(iara, quests, level)
    followNext(dialogue, 'memoria', quests)
    acceptFromDialogue(dialogue, 'secundaria-14', quests)
    completeObjectives(quests, 'secundaria-14')

    quests.states.set('principal-09', { status: 'concluida', progress: {} })
    dialogue.open(vekh, quests, level)
    followNext(dialogue, 'confissao', quests)
    followNext(dialogue, 'divida', quests)
    acceptFromDialogue(dialogue, 'secundaria-15', quests)
    completeObjectives(quests, 'secundaria-15')

    expect(quests.isCompleted('secundaria-13')).toBe(true)
    expect(quests.isCompleted('secundaria-14')).toBe(true)
    expect(quests.isCompleted('secundaria-15')).toBe(true)
  })
})
