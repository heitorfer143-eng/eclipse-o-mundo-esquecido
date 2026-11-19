import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { CameraRig } from '../src/game/camera'
import { parseSave, SAVE_KEY, SaveStore } from '../src/engine/save'
import { DEFAULT_CHARACTER_PROFILE, isCharacterNameValid } from '../src/game/data/characterProfile'
import { BOSSES } from '../src/game/data/bossData'
import { ENEMIES } from '../src/game/data/enemyData'
import { Boss } from '../src/game/entities/boss'
import { Enemy } from '../src/game/entities/enemy'
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

    const restored = new SaveStore(storage)
    expect(restored.data.game?.seed).toBe(seed)
    expect(restored.data.campaigns).toHaveLength(1)
    expect(restored.activeCampaign?.game?.seed).toBe(seed)
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
  it('mantém personagens e progressos separados ao criar e alternar campanhas', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
      removeItem: (key: string) => { values.delete(key) },
    }
    const store = new SaveStore(storage)
    const firstProfile = { name: 'Eira', modelId: 'Rogue_Hooded' as const, auraColor: '#c094ff' as const }
    const secondProfile = { name: 'Tarin', modelId: 'Mage' as const, auraColor: '#ffcc70' as const }
    const firstId = store.createCampaign(firstProfile, 11)!
    store.saveGame({
      seed: 11, position: [4, 30, -8], facing: 0, playtime: 120, timeOfDay: 0.5,
      progression: { level: 7, xp: 800, attributePoints: 0, skillPoints: 0, attributes: {} },
      inventory: { stacks: [], equipment: {}, gold: 55 }, skills: {},
      quests: { tracked: 'principal-01', states: {} }, discovered: ['poi-1'], openedChests: [],
      deaths: 1, kills: 9, createdAt: 10, updatedAt: 20,
    })
    const secondId = store.createCampaign(secondProfile, 22)!
    store.saveGame({
      seed: 22, position: [0, 40, 800], facing: 0, playtime: 12, timeOfDay: 0.3,
      progression: { level: 2, xp: 30, attributePoints: 0, skillPoints: 0, attributes: {} },
      inventory: { stacks: [], equipment: {}, gold: 4 }, skills: {},
      quests: { tracked: null, states: {} }, discovered: [], openedChests: [],
      deaths: 0, kills: 1, createdAt: 30, updatedAt: 30,
    })

    expect(store.data.campaigns).toHaveLength(2)
    expect(store.data.activeCampaignId).toBe(secondId)
    expect(store.activateCampaign(firstId)).toBe(true)
    expect(store.data.profile).toEqual(firstProfile)
    expect(store.data.game).toMatchObject({ seed: 11, progression: { level: 7 }, inventory: { gold: 55 } })
    const restored = new SaveStore(storage)
    expect(restored.data.campaigns).toHaveLength(2)
    expect(restored.activeCampaign?.id).toBe(firstId)
    expect(restored.data.profile.name).toBe('Eira')
    expect(restored.data.campaigns.find(slot => slot.id === secondId)?.game?.progression.level).toBe(2)
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

describe('abertura da campanha', () => {
  it('oferece O Despertar por Iara e só rastreia a missão depois do aceite', () => {
    const quests = new QuestLog()
    const openingQuest = questById('principal-01')!

    expect(quests.tracked).toBeNull()
    expect(quests.state(openingQuest.id)).toBeUndefined()
    expect(quests.forNpc('iara', 1).offer.map(quest => quest.id)).toContain(openingQuest.id)
    expect(quests.accept(openingQuest.id, 1)).toBeNull()
    expect(quests.tracked).toBe(openingQuest.id)
    expect(quests.state(openingQuest.id)?.status).toBe('ativa')
  })

  it('remove o rastreador fantasma de save antigo sem descartar missão já aceita', () => {
    const quests = new QuestLog()
    quests.load({ tracked: 'principal-01', states: {} })
    expect(quests.tracked).toBeNull()

    quests.load({ tracked: 'principal-01', states: { 'principal-01': { status: 'ativa', progress: {} } } })
    expect(quests.tracked).toBe('principal-01')
  })
})

describe('câmera de terceira pessoa', () => {
  it('ajusta o campo de visão em retrato e restaura em paisagem', () => {
    const camera = new CameraRig(1)
    camera.resize(390, 844)
    expect(camera.camera.fov).toBe(72)
    camera.resize(844, 390)
    expect(camera.camera.fov).toBe(62)
  })

  it('encurta o enquadramento antes de atravessar uma parede', () => {
    const camera = new CameraRig(1)
    const target = new THREE.Vector3(0, 0, 0)
    const wall = { kind: 'box' as const, minX: -2, maxX: 2, minZ: 3, maxZ: 4, top: 5, bottom: 0, blocking: true }

    camera.reset(target)
    camera.update(1 / 60, target, { x: 0, y: 0 }, {
      groundAt: () => 0,
      collidersNear: () => [wall],
    }, false, false)

    expect(camera.camera.position.z).toBeLessThan(3)
    expect(camera.camera.position.z).toBeGreaterThan(0)
  })
})

describe('escala dos chefes', () => {
  it('mantém todos os chefes em tamanho legível e compatível com a câmera', () => {
    for (const definition of BOSSES) {
      const boss = new Boss(definition, 0, 0)
      expect(boss.height, definition.id).toBeLessThanOrEqual(2.45)
      boss.dispose()
    }
  })
})

describe('escala de mobs', () => {
  it('mantém a Aranha Tecelã pequena também na largura das patas', () => {
    const definition = ENEMIES.find(enemy => enemy.id === 'aranha-tecela')!
    const spider = new Enemy({ def: definition, level: 2, x: 0, z: 0 })
    try {
      const visual = (spider as unknown as { visual: { root: THREE.Group } }).visual.root
      const size = new THREE.Box3().setFromObject(visual).getSize(new THREE.Vector3())
      expect(spider.height).toBeLessThanOrEqual(0.35)
      expect(Math.max(size.x, size.z)).toBeLessThanOrEqual(0.6)
    } finally {
      spider.dispose()
    }
  })
})
