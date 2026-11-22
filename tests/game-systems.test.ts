import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { CameraRig } from '../src/game/camera'
import { parseSave, SAVE_KEY, SaveStore } from '../src/engine/save'
import { CHARACTER_OPTIONS, DEFAULT_CHARACTER_PROFILE, isCharacterNameValid, parseCharacterProfile } from '../src/game/data/characterProfile'
import { BOSSES } from '../src/game/data/bossData'
import { ENEMIES } from '../src/game/data/enemyData'
import { Boss } from '../src/game/entities/boss'
import { ENEMY_VISUAL_LIMITS, Enemy } from '../src/game/entities/enemy'
import { pickEnemyFor } from '../src/game/entities/spawner'
import { CharacterModel, externalAnimationFor, type AnimState } from '../src/game/entities/character'
import { characterModelPathFor } from '../src/game/entities/characterAssets'
import { externalHumanoidUrlForModel, EXTERNAL_CHARACTER_URLS, resolveExternalClipName, type ExternalAnimation } from '../src/game/entities/externalModels'
import { NPCS } from '../src/game/data/npcData'
import { itemById } from '../src/game/data/itemData'
import { RECIPES } from '../src/game/data/recipeData'
import { QUESTS, questById } from '../src/game/data/questData'
import { DialogueRunner } from '../src/game/systems/dialogue'
import { Inventory } from '../src/game/systems/inventory'
import { QuestLog } from '../src/game/systems/quests'
import { SkillTree } from '../src/game/systems/skills'
import { Terrain } from '../src/game/world/terrain'
import { buildVillage } from '../src/game/world/structures'
import { createHouseInterior } from '../src/game/world/interior'
import { resolveAnimalClipName, selectWildlifeForBiome, wildlifeCanBeMounted, wildlifeOptionsForBiome } from '../src/game/world/chunks'
import { npcAmbientLine, npcDailyDestination } from '../src/game/entities/npcRoutines'
import { grassGeometry, rockGeometry, treeGeometries } from '../src/game/world/props'
import { ABILITIES, abilityUnlocked, ELEMENTAL_MASTERY_LEVEL } from '../src/game/combat/abilities'
import { canCraft, craft, shopFor } from '../src/game/systems/economy'
import { Weather } from '../src/game/world/weather'

const samplePoints = [
  [-1420, -930],
  [-370, 640],
  [510, -1180],
  [980, 430],
  [1450, 1120],
] as const

describe('clima e alinhamento de partículas', () => {
  it('mantém os traços de chuva centrados na câmera durante o deslocamento', () => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 900)
    const weather = new Weather(scene)
    camera.position.set(18, 12, -9)
    weather.set('chuva', true)
    weather.update(1 / 60, camera, 'floresta', 0)
    const streaks = (weather as unknown as { rainStreaks: THREE.LineSegments }).rainStreaks
    expect(streaks.position.toArray()).toEqual(camera.position.toArray())
    streaks.geometry.dispose()
    ;(streaks.material as THREE.Material).dispose()
  })
})

describe('mundo procedural', () => {
  it('é determinístico para a mesma seed e varia entre seeds', () => {
    const first = new Terrain(731_029)
    const repeated = new Terrain(731_029)
    const other = new Terrain(9_104_663)
    const heights = (terrain: Terrain): number[] => samplePoints.map(([x, z]) => terrain.heightAt(x, z))

    expect(heights(repeated)).toEqual(heights(first))
    expect(heights(other)).not.toEqual(heights(first))
  })

  it('encontra um ponto de caça caminhável dentro dos biomas permitidos', () => {
    const terrain = new Terrain(731_029)
    const allowed = ['floresta', 'floresta-densa', 'planicie'] as const
    const point = terrain.nearestWalkableBiome(6, 806, allowed, 900)
    const repeated = terrain.nearestWalkableBiome(6, 806, allowed, 900)

    expect(point).not.toBeNull()
    expect(repeated).toEqual(point)
    expect(allowed).toContain(point!.biome)
    expect(terrain.heightAt(point!.x, point!.z)).toBeGreaterThan(2.6)
    expect(terrain.slopeAt(point!.x, point!.z)).toBeLessThanOrEqual(0.62)
    expect(point!.distance).toBeGreaterThanOrEqual(47.99)
  })

  it('fornece UVs para grama, troncos, copas e rochas texturizadas', () => {
    const tree = treeGeometries('carvalho')!
    const rock = rockGeometry(0)
    for (const geometry of [grassGeometry(), rock, tree.bark!, tree.foliage!]) {
      expect(geometry.getAttribute('uv')?.count).toBe(geometry.getAttribute('position').count)
    }
    const colors = rock.getAttribute('color')
    expect(colors?.count).toBe(rock.getAttribute('position').count)
    expect((colors?.getX(0) ?? 0)).toBeGreaterThan(0.7)
  })
})

describe('interiores de casas', () => {
  it('cria um cômodo com portas, piso e limites de colisão finitos', () => {
    const room = createHouseInterior('vila-brumal-house-1')
    const bounds = new THREE.Box3().setFromObject(room.root)
    expect(room.root.name).toBe('interior-vila-brumal-house-1')
    expect(bounds.isEmpty()).toBe(false)
    expect([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)).toBe(true)
    expect(room.spawn.y).toBe(room.floorY + 0.08)
    expect(room.exit.y).toBe(room.floorY + 0.08)
    expect(room.colliders.filter(collider => collider.kind === 'box' && collider.blocking)).toHaveLength(8)
    expect(room.colliders.every(collider => collider.kind !== 'box' || Number.isFinite(collider.top))).toBe(true)
    room.dispose()
    expect(room.root.children).toHaveLength(0)
  })
})

describe('efeitos agregados da árvore de habilidades', () => {
  it('soma corretamente os bônus por nível sem multiplicá-los duas vezes', () => {
    const skills = new SkillTree()
    skills.ranks.set('lamina-forca', 2)
    skills.ranks.set('lamina-critico', 1)
    skills.ranks.set('arcano-poder', 2)
    skills.ranks.set('arcano-mana', 2)
    skills.ranks.set('arcano-regeneracao', 1)
    skills.ranks.set('sombra-agil', 2)
    skills.ranks.set('sombra-sanguessuga', 1)
    skills.ranks.set('sombra-veneno', 1)
    skills.ranks.set('sombra-sorte', 1)
    expect(skills.effects()).toMatchObject({
      physicalDamage: 0.16, critBonus: 0.05, magicDamage: 0.16, manaBonus: 40,
      manaRegen: 0.8, moveSpeed: 0.08, lifesteal: 0.03, statusDamage: 0.15, lootBonus: 0.08,
    })
  })
})

describe('progressão elemental e ferramentas', () => {
  it('desbloqueia os três círculos nos níveis 1, 14 e 22 e reserva a maestria para o 40', () => {
    expect(ABILITIES.filter(ability => ability.tier === 1).every(ability => ability.level === 1)).toBe(true)
    expect(ABILITIES.filter(ability => ability.tier === 2).every(ability => ability.level === 14)).toBe(true)
    expect(ABILITIES.filter(ability => ability.tier === 3).every(ability => ability.level === 22)).toBe(true)
    expect(abilityUnlocked(ABILITIES.find(ability => ability.tier === 2)!, 13)).toBe(false)
    expect(abilityUnlocked(ABILITIES.find(ability => ability.tier === 2)!, 14)).toBe(true)
    expect(ELEMENTAL_MASTERY_LEVEL).toBe(40)
  })

  it('vende machado e picareta pelo sistema de inventário e ouro existente', () => {
    const inventory = new Inventory()
    inventory.gold = 500
    const shop = shopFor('ferreiro')
    expect(shop.buy('tool-machado', inventory, 1)).toBeNull()
    expect(shop.buy('tool-picareta', inventory, 1)).toBeNull()
    expect(inventory.has('tool-machado')).toBe(true)
    expect(inventory.has('tool-picareta')).toBe(true)
    expect(itemById('mat-pedra')).toBeDefined()
    expect(inventory.gold).toBeLessThan(500)
  })
})

describe('clareza e transações de inventário', () => {
  it('canAdd contabiliza espaço em pilhas e a prévia compara o equipamento com o slot de destino', () => {
    const inventory = new Inventory()
    inventory.capacity = 1
    inventory.add('mat-ferro', 98)
    expect(inventory.canAdd('mat-ferro', 1)).toBe(true)
    expect(inventory.canAdd('mat-ferro', 2)).toBe(false)
    expect(inventory.canAdd('mat-madeira', 1)).toBe(false)
    expect(inventory.canAddItems([{ itemId: 'mat-ferro', count: 1 }])).toBe(true)
    expect(inventory.canAddItems([{ itemId: 'mat-ferro', count: 1 }, { itemId: 'pocao-vida-1', count: 1 }])).toBe(false)

    const gear = new Inventory()
    gear.equipment.arma = { id: 'arma-espada-1', count: 1, plus: 0 }
    gear.add('arma-espada-2')
    expect(gear.previewEquipIndex(0)).toEqual({
      slot: 'arma',
      selected: { id: 'arma-espada-2', count: 1, plus: 0 },
      current: { id: 'arma-espada-1', count: 1, plus: 0 },
      changes: { ataque: 5, critico: 2 },
    })
  })

  it('não consome materiais nem ouro se o resultado do crafting não couber', () => {
    const inventory = new Inventory()
    inventory.capacity = 3
    inventory.gold = 30
    inventory.add('mat-ferro', 5)
    inventory.add('mat-madeira', 2)
    inventory.add('mat-couro', 2)
    const recipe = RECIPES.find(entry => entry.id === 'receita-espada-2')!

    expect(canCraft(recipe, inventory, 7)).toBe('Inventário cheio.')
    expect(craft(recipe, inventory, 7)).toBe('Inventário cheio.')
    expect(inventory.count('mat-ferro')).toBe(5)
    expect(inventory.count('mat-madeira')).toBe(2)
    expect(inventory.count('mat-couro')).toBe(2)
    expect(inventory.gold).toBe(30)
    expect(inventory.has('arma-espada-2')).toBe(false)
  })

  it('bloqueia compra sem espaço ou nível suficiente sem descontar ouro', () => {
    const inventory = new Inventory()
    inventory.gold = 10_000
    inventory.capacity = 1
    inventory.add('mat-ferro', 1)
    const shop = shopFor('ferreiro')

    expect(shop.buy('arma-espada-1', inventory, 1)).toBe('Inventário cheio.')
    expect(inventory.gold).toBe(10_000)
    expect(inventory.count('mat-ferro')).toBe(1)
    expect(shop.buy('arma-espada-2', inventory, 1)).toBe('Requer nível 7.')
    expect(inventory.gold).toBe(10_000)
  })
})

describe('classe e modelos do protagonista', () => {
  it('oferece somente Soldado/Paladino e mantém o Survivor apenas em saves antigos', () => {
    expect(CHARACTER_OPTIONS.map(option => option.id)).toEqual(['Soldier', 'Paladin'])
    expect(DEFAULT_CHARACTER_PROFILE.modelId).toBe('Soldier')
    expect(parseCharacterProfile({ modelId: 'Survivor' }).modelId).toBe('Survivor')
    expect(characterModelPathFor('Survivor')).toBeNull()
  })

  it('usa roupa civil no início e o modelo armado correspondente ao equipar armadura', () => {
    expect(characterModelPathFor('Soldier')).toBe('assets/models/quaternius/characters/Casual_Male.gltf')
    expect(characterModelPathFor('Soldier', true)).toBe('assets/models/quaternius/characters/Soldier_Male.gltf')
    expect(characterModelPathFor('Paladin')).toBe('assets/models/quaternius/characters/Casual_Male.gltf')
    expect(characterModelPathFor('Paladin', true)).toBe('assets/models/quaternius/characters/Knight_Golden_Male.gltf')
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
    store.updateProfile({ name: 'Eira da Lua', modelId: 'Rogue_Hooded', auraColor: '#c094ff' , element: 'fogo' as const })
    store.saveGame({
      seed: 7, position: [0, 40, 800], facing: 0, playtime: 0, timeOfDay: 0.32,
      progression: { level: 1, xp: 0, attributePoints: 0, skillPoints: 0, attributes: {} },
      inventory: { stacks: [], equipment: {}, gold: 0 }, skills: {},
      quests: { tracked: null, states: {} }, discovered: [], openedChests: [],
      deaths: 0, kills: 0, createdAt: 1, updatedAt: 1,
    })
    const restored = new SaveStore(storage)
    expect(restored.data.profile).toEqual({ name: 'Eira da Lua', modelId: 'Rogue_Hooded', auraColor: '#c094ff' , element: 'fogo' as const })
    restored.clearGame()
    expect(new SaveStore(storage).data.game).toBeNull()
    expect(new SaveStore(storage).data.profile).toEqual({ name: 'Eira da Lua', modelId: 'Rogue_Hooded', auraColor: '#c094ff' , element: 'fogo' as const })
    expect(isCharacterNameValid('Eira')).toBe(true)
    expect(isCharacterNameValid(' ')).toBe(false)

    values.set(SAVE_KEY, JSON.stringify({ version: 2, game: null, profile: { modelId: '<script>', auraColor: 'url(javascript:alert(1))' } , element: 'fogo' as const }))
    expect(new SaveStore(storage).data.profile).toEqual(DEFAULT_CHARACTER_PROFILE)
  })
  it('mantém uma única campanha e recusa criar outra ou mudar a identidade', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
      removeItem: (key: string) => { values.delete(key) },
    }
    const store = new SaveStore(storage)
    const firstProfile = { name: 'Eira', modelId: 'Rogue_Hooded' as const, auraColor: '#c094ff' as const , element: 'fogo' as const }
    const secondProfile = { name: 'Tarin', modelId: 'Mage' as const, auraColor: '#ffcc70' as const , element: 'fogo' as const }
    const attemptedChange = { name: 'Eira nova', modelId: 'Barbarian' as const, auraColor: '#ff785f' as const , element: 'fogo' as const }
    const firstId = store.createCampaign(firstProfile, 11)!
    expect(store.updateProfile(attemptedChange)).toEqual(firstProfile)
    expect(store.updateCampaignProfile(firstId, attemptedChange)).toBeNull()
    expect(store.activeCampaign?.profile).toEqual(firstProfile)
    expect(store.createCampaign(secondProfile, 22)).toBeNull()
    store.saveGame({
      seed: 11, position: [4, 30, -8], facing: 0, playtime: 120, timeOfDay: 0.5,
      progression: { level: 7, xp: 800, attributePoints: 0, skillPoints: 0, attributes: {} },
      inventory: { stacks: [], equipment: {}, gold: 55 }, skills: {},
      quests: { tracked: 'principal-01', states: {} }, discovered: ['poi-1'], openedChests: [],
      deaths: 1, kills: 9, createdAt: 10, updatedAt: 20,
    })
    expect(store.data.campaigns).toHaveLength(1)
    expect(store.data.activeCampaignId).toBe(firstId)
    expect(store.activateCampaign('campaign-inexistente')).toBe(false)
    expect(store.data.profile).toEqual(firstProfile)
    expect(store.data.game).toMatchObject({ seed: 11, progression: { level: 7 }, inventory: { gold: 55 } })
    const restored = new SaveStore(storage)
    expect(restored.data.campaigns).toHaveLength(1)
    expect(restored.activeCampaign?.id).toBe(firstId)
    expect(restored.data.profile.name).toBe('Eira')
    expect(restored.createCampaign(secondProfile, 22)).toBeNull()
  })
  it('exige excluir a campanha atual antes de iniciar outra e preserva as configurações', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
      removeItem: (key: string) => { values.delete(key) },
    }
    const store = new SaveStore(storage)
    const settings = { ...store.data.settings }
    const firstProfile = { name: 'Eira', modelId: 'Rogue_Hooded' as const, auraColor: '#c094ff' as const , element: 'fogo' as const }
    const secondProfile = { name: 'Tarin', modelId: 'Mage' as const, auraColor: '#ffcc70' as const , element: 'fogo' as const }
    const firstId = store.createCampaign(firstProfile, 11)!
    store.saveGame({
      seed: 11, position: [4, 30, -8], facing: 0, playtime: 120, timeOfDay: 0.5,
      progression: { level: 7, xp: 800, attributePoints: 0, skillPoints: 0, attributes: {} },
      inventory: { stacks: [], equipment: {}, gold: 55 }, skills: {},
      quests: { tracked: 'principal-01', states: {} }, discovered: ['poi-1'], openedChests: [],
      deaths: 1, kills: 9, createdAt: 10, updatedAt: 20,
    })
    expect(store.deleteCampaign('missing-slot')).toBe(false)
    expect(store.createCampaign(secondProfile, 22)).toBeNull()
    expect(store.deleteCampaign(firstId)).toBe(true)
    expect(store.data.campaigns).toHaveLength(0)
    expect(store.data.activeCampaignId).toBeNull()
    expect(store.data.profile).toEqual(DEFAULT_CHARACTER_PROFILE)
    expect(store.data.game).toBeNull()
    expect(store.data.settings).toEqual(settings)

    const restored = new SaveStore(storage)
    const nextId = restored.createCampaign(secondProfile, 22)
    expect(nextId).not.toBeNull()
    expect(restored.data.campaigns).toHaveLength(1)
    expect(restored.activeCampaign?.profile).toEqual(secondProfile)
    expect(restored.activeCampaign?.seed).toBe(22)
    expect(restored.data.settings).toEqual(settings)
  })
  it('permite completar identidade de save legado incompleto apenas uma vez', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
      removeItem: (key: string) => { values.delete(key) },
    }
    const store = new SaveStore(storage)
    const id = store.createCampaign({ name: '', modelId: 'Knight', auraColor: '#7fe3ff' , element: 'fogo' as const }, 33)!
    const completed = { name: 'Nara', modelId: 'Rogue' as const, auraColor: '#8ee18a' as const , element: 'fogo' as const }
    expect(store.updateCampaignProfile(id, completed)).toEqual(completed)
    expect(store.updateCampaignProfile(id, { ...completed, name: 'Nara alterada' })).toBeNull()
    expect(store.activeCampaign?.profile).toEqual(completed)
  })
  it('preserva flags de história distintas e aceita somente o contexto de interior válido', () => {
    const parsed = parseSave(JSON.stringify({ version: 4, game: {
      storyFlags: ['iara:intro', 'iara:intro', 'boss:guardiao', 'texto inválido'],
      interior: { houseId: 'vila-brumal-house-1', houseName: 'Brumal · Casa 1' },
    } }))
    expect(parsed.game?.storyFlags).toEqual(['iara:intro', 'boss:guardiao'])
    expect(parsed.game?.interior).toEqual({ houseId: 'vila-brumal-house-1', houseName: 'Brumal · Casa 1' })

    const unsafe = parseSave(JSON.stringify({ version: 4, game: {
      storyFlags: ['ok', 'space is invalid'], interior: { houseId: '../../outside', houseName: '   ' },
    } }))
    expect(unsafe.game?.storyFlags).toEqual(['ok'])
    expect(unsafe.game?.interior).toBeNull()
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

describe('diálogo inicial de Velho Thom', () => {
  it('fala da marca e mantém acessível a oferta da missão secundária do anel', () => {
    const quests = new QuestLog()
    const dialogue = new DialogueRunner()
    const thom = NPCS.find(npc => npc.id === 'velho-thom')!
    dialogue.open(thom, quests, 3)
    expect(dialogue.node?.text).toContain('marca')
    const choices = dialogue.choices(quests, 3)
    expect(choices.some(choice => choice.next === 'marca')).toBe(true)
    const anelChoice = choices.findIndex(choice => choice.next === 'anel')
    expect(anelChoice).toBeGreaterThanOrEqual(0)
    dialogue.select(anelChoice, quests, 3)
    expect(dialogue.choices(quests, 3)).toContainEqual(expect.objectContaining({ action: 'aceitar', quest: 'secundaria-01' }))
  })
})

describe('retorno contextual dos diálogos', () => {
  it('abre a Iara no nó de retorno sem reproduzir o texto da introdução', () => {
    const quests = new QuestLog()
    const dialogue = new DialogueRunner()
    const iara = NPCS.find(npc => npc.id === 'iara')!
    dialogue.open(iara, quests, 1, 'retorno')
    expect(dialogue.node?.id).toBe('retorno')
    expect(dialogue.node?.text).not.toBe(iara.nodes.raiz.text)
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

  it('leva O Despertar por quatro etapas até a recompensa que o jogo deve entregar', () => {
    const quests = new QuestLog()
    const inventory = new Inventory()
    const quest = questById('principal-01')!
    expect(quests.accept(quest.id, 1)).toBeNull()

    quest.objectives.forEach((objective, index) => {
      if (objective.kind === 'coletar') {
        inventory.add(objective.target, objective.count)
        quests.syncInventory(inventory)
      } else {
        quests.progress(objective.kind, objective.target, objective.count)
      }
      expect(quests.ready(quest.id)).toBe(index === quest.objectives.length - 1)
    })

    expect(quests.forNpc('iara', 1).turnIn.map(item => item.id)).toContain(quest.id)
    expect(quests.complete(quest.id)).toEqual({
      xp: 120,
      gold: 60,
      items: [
        { itemId: 'pocao-vida-1', count: 2 },
        { itemId: 'comida-pao', count: 3 },
        { itemId: 'armadura-andarilho', count: 1 },
      ],
    })
    expect(quests.nextMainQuest()?.id).toBe('principal-02')
  })

  it('recomenda primeiro Brumal e avança a Aster após os pré-requisitos da história', () => {
    const quests = new QuestLog()
    expect(quests.nextMainQuest()?.id).toBe('principal-01')
    quests.states.set('principal-01', { status: 'concluida', progress: {} })
    expect(quests.nextMainQuest()).toMatchObject({ id: 'principal-02', marker: 'cidade-aster', minLevel: 5 })
    quests.states.set('principal-02', { status: 'concluida', progress: {} })
    expect(quests.nextMainQuest()?.id).toBe('principal-03')
  })

  it('remove o rastreador fantasma de save antigo sem descartar missão já aceita', () => {
    const quests = new QuestLog()
    quests.load({ tracked: 'principal-01', states: {} })
    expect(quests.tracked).toBeNull()

    quests.load({ tracked: 'principal-01', states: { 'principal-01': { status: 'ativa', progress: {} } } })
    expect(quests.tracked).toBe('principal-01')
  })

  it('mantém os três lobos e três ervas da primeira etapa disponíveis também de dia', () => {
    const village = buildVillage(new Terrain(731_029), 0, 0, 11, 'Brumal')
    const wolf = pickEnemyFor('floresta', 2, 0.1, 'lobo-sombrio')
    const quest = questById('principal-01')!

    expect(wolf?.id).toBe('lobo-sombrio')
    expect(village.spots.enemies).toHaveLength(3)
    expect(village.spots.resources.filter(resource => resource.kind === 'erva')).toHaveLength(3)
    expect(quest.objectives.find(objective => objective.target === 'lobo-sombrio')?.count).toBe(3)
    expect(quest.objectives.find(objective => objective.target === 'mat-erva')?.count).toBe(3)
  })

  it('conta lobos sombrios abatidos na missão ativa e limita o progresso ao objetivo', () => {
    const quests = new QuestLog()
    expect(quests.accept('principal-01', 1)).toBeNull()

    expect(quests.progress('matar', 'lobo-da-nevoa')).toEqual([])
    expect(quests.objectiveProgress('principal-01', 'obj-p01-1')).toBe(0)
    expect(quests.progress('matar', 'lobo-sombrio')).toEqual(['principal-01'])
    expect(quests.objectiveProgress('principal-01', 'obj-p01-1')).toBe(1)
    quests.progress('matar', 'lobo-sombrio', 5)
    expect(quests.objectiveProgress('principal-01', 'obj-p01-1')).toBe(3)
    expect(quests.ready('principal-01')).toBe(false)
  })
})

describe('aparência de progressão do protagonista', () => {
  it('começa como sobrevivente simples e revela peitoral, ombreira, placas e braçadeira ao equipar couro', () => {
    const model = new CharacterModel({}, '')
    try {
      expect(model.visibleGearState).toEqual({ survivor: true, armor: false, helmet: false, boots: false })
      const partNames: string[] = []
      model.root.traverse(object => { if (object.name.startsWith('equipment-')) partNames.push(object.name) })
      expect(partNames).toEqual(expect.arrayContaining([
        'equipment-armor-torso', 'equipment-breastplate', 'equipment-pauldron-left',
        'equipment-tasset', 'equipment-bracer-plate-left', 'equipment-greave-plate-left',
      ]))

      model.setEquipment({ armor: true, armorStyle: 'andarilho' })
      expect(model.visibleGearState).toEqual({ survivor: true, armor: true, helmet: false, boots: false })
      const cuirass = model.root.getObjectByName('equipment-cuirass-shell') as THREE.Mesh
      expect((cuirass.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('765238')

      model.setEquipment({ armor: true, armorStyle: 'sentinela' })
      expect((cuirass.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('b9c2cb')
      model.setEquipment({ armor: false, helmet: false, boots: false, armorStyle: 'andarilho' })
      expect(model.visibleGearState).toEqual({ survivor: true, armor: false, helmet: false, boots: false })
    } finally {
      model.dispose()
    }
  })

  it('libera o Manto do Andarilho no primeiro nível somente como recompensa da missão inicial', () => {
    const quest = questById('principal-01')!
    expect(quest.rewards.items).toContainEqual({ itemId: 'armadura-andarilho', count: 1 })
    expect(itemById('armadura-andarilho')?.level).toBe(1)
    const inventory = new Inventory()
    inventory.add('armadura-andarilho', 1)
    expect(inventory.equipment.armadura).toBeNull()
    expect(inventory.equipIndex(0, 1)).toBeNull()
    expect(inventory.equipment.armadura?.id).toBe('armadura-andarilho')
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

  it('mantém o Guardião da primeira missão no nível e na vida de abertura', () => {
    const firstBoss = BOSSES.find(boss => boss.id === 'guardiao-floresta-corrompido')!
    expect(firstBoss.level).toBe(2)
    expect(firstBoss.health).toBe(320)
  })
})

describe('efeitos de status', () => {
  it('aplica bônus de dano e duração ao status elemental e o remove ao expirar', () => {
    const enemy = new Enemy({ def: ENEMIES.find(entry => entry.id === 'lobo-sombrio')!, level: 1, x: 0, z: 0 })
    const ctx = {
      playerPosition: new THREE.Vector3(100, 0, 100), playerDead: true, playerStealth: 0,
      groundAt: () => 0, collidersNear: () => [], night: 0, inCombat: false,
    }
    try {
      enemy.takeDamage(1, { element: 'fogo', statusDuration: 0.5, statusDamage: 1 })
      expect(enemy.hasStatus('queimando')).toBe(true)
      const beforeTick = enemy.health
      enemy.update(1, ctx, [])
      expect(enemy.health).toBeLessThan(beforeTick - 6)
      const afterTick = enemy.health
      enemy.update(5.1, ctx, [])
      expect(enemy.hasStatus('queimando')).toBe(false)
      expect(enemy.health).toBe(afterTick)
    } finally {
      enemy.dispose()
    }
  })
})

describe('escala de mobs', () => {
  it('mantém todos os mobs comuns e elites dentro dos limites de altura e pegada', () => {
    for (const definition of ENEMIES) {
      for (const elite of [false, true]) {
        const enemy = new Enemy({ def: definition, level: 2, x: 0, z: 0, elite })
        try {
          const visual = (enemy as unknown as { visual: { root: THREE.Group } }).visual.root
          const size = new THREE.Box3().setFromObject(visual).getSize(new THREE.Vector3())
          const heightLimit = elite ? ENEMY_VISUAL_LIMITS.eliteHeight : ENEMY_VISUAL_LIMITS.commonHeight
          const footprintLimit = elite ? ENEMY_VISUAL_LIMITS.eliteFootprint : ENEMY_VISUAL_LIMITS.commonFootprint
          expect(size.y, `${definition.id} elite=${elite} height`).toBeLessThanOrEqual(heightLimit + 0.01)
          expect(Math.max(size.x, size.z), `${definition.id} elite=${elite} footprint`).toBeLessThanOrEqual(footprintLimit + 0.01)
        } finally {
          enemy.dispose()
        }
      }
    }
  })
})

describe('animações do protagonista', () => {
  const base: AnimState = {
    mode: 'idle', speed: 0, actionTime: 0, actionDuration: 0.5, combo: 0, weapon: 'espada', charging: false,
  }

  it('seleciona clips reais de locomoção, esquiva, bloqueio, dano e morte', () => {
    expect(externalAnimationFor({ ...base, mode: 'walk' })).toBe('walk')
    expect(externalAnimationFor({ ...base, mode: 'run' })).toBe('run')
    expect(externalAnimationFor({ ...base, mode: 'roll', rollDirection: 'left' })).toBe('dodge-left')
    expect(externalAnimationFor({ ...base, mode: 'roll', rollDirection: 'backward' })).toBe('dodge-backward')
    expect(externalAnimationFor({ ...base, mode: 'jump' })).toBe('jump')
    expect(externalAnimationFor({ ...base, mode: 'block' })).toBe('block')
    expect(externalAnimationFor({ ...base, mode: 'cast' })).toBe('cast')
    expect(externalAnimationFor({ ...base, mode: 'hurt' })).toBe('hit')
    expect(externalAnimationFor({ ...base, mode: 'dead' })).toBe('death')
  })

  it('escolhe ataque compatível com o tipo de arma equipado', () => {
    expect(externalAnimationFor({ ...base, mode: 'attack', weapon: 'espada' })).toBe('attack')
    expect(externalAnimationFor({ ...base, mode: 'attack', weapon: 'machado' })).toBe('attack-heavy')
    expect(externalAnimationFor({ ...base, mode: 'attack', weapon: 'lanca' })).toBe('attack-thrust')
    expect(externalAnimationFor({ ...base, mode: 'attack', weapon: 'adaga' })).toBe('attack-fast')
    expect(externalAnimationFor({ ...base, mode: 'attack', weapon: 'arco' })).toBe('attack-ranged')
  })

  it('resolve os nomes normalizados para os clips que realmente existem nos modelos KayKit', () => {
    const actualClips = [
      'Idle', 'Walking_A', 'Running_A',
      '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Stab', '2H_Melee_Attack_Chop',
      'Dualwield_Melee_Attack_Slice', '1H_Ranged_Shoot', 'Spellcast_Shoot',
      'Hit_A', 'Death_A', 'Dodge_Forward', 'Dodge_Backward', 'Dodge_Left', 'Dodge_Right',
      'Jump_Full_Short', 'Jump_Idle', 'Blocking',
    ]
    const expectations: [ExternalAnimation, string][] = [
      ['idle', 'Idle'], ['walk', 'Walking_A'], ['run', 'Running_A'], ['attack', '1H_Melee_Attack_Slice_Horizontal'],
      ['attack-heavy', '2H_Melee_Attack_Chop'], ['attack-thrust', '1H_Melee_Attack_Stab'],
      ['attack-fast', 'Dualwield_Melee_Attack_Slice'], ['attack-ranged', '1H_Ranged_Shoot'], ['cast', 'Spellcast_Shoot'],
      ['hit', 'Hit_A'], ['death', 'Death_A'], ['dodge-forward', 'Dodge_Forward'], ['dodge-backward', 'Dodge_Backward'],
      ['dodge-left', 'Dodge_Left'], ['dodge-right', 'Dodge_Right'], ['jump', 'Jump_Full_Short'],
      ['fall', 'Jump_Idle'], ['block', 'Blocking'],
    ]
    for (const [mode, clip] of expectations) expect(resolveExternalClipName(mode, actualClips)).toBe(clip)
  })

  it('resolve os clips Quaternius de movimento, combate e morte', () => {
    const clips = ['Death', 'Defeat', 'Idle', 'Jump', 'PickUp', 'Punch', 'RecieveHit', 'Roll', 'Run', 'Run_Carry', 'Shoot_OneHanded', 'SitDown', 'StandUp', 'SwordSlash', 'Victory', 'Walk', 'Walk_Carry']
    const expectations: [ExternalAnimation, string][] = [
      ['idle', 'Idle'], ['walk', 'Walk'], ['run', 'Run'], ['attack', 'SwordSlash'],
      ['attack-heavy', 'SwordSlash'], ['attack-thrust', 'SwordSlash'], ['attack-fast', 'Punch'],
      ['attack-ranged', 'Shoot_OneHanded'], ['cast', 'Shoot_OneHanded'], ['hit', 'RecieveHit'],
      ['death', 'Death'], ['dodge-forward', 'Roll'], ['dodge-backward', 'Roll'],
      ['dodge-left', 'Roll'], ['dodge-right', 'Roll'], ['jump', 'Jump'],
    ]
    for (const [mode, clip] of expectations) expect(resolveExternalClipName(mode, clips)).toBe(clip)
  })

  it('reconhece os clips nomeados dos personagens Gobkit sem quebrar os clips KayKit', () => {
    const clips = ['idle', 'walk', 'run', 'attack', 'dead', 'hit', 'special']
    expect(resolveExternalClipName('idle', clips)).toBe('idle')
    expect(resolveExternalClipName('walk', clips)).toBe('walk')
    expect(resolveExternalClipName('run', clips)).toBe('run')
    expect(resolveExternalClipName('attack', clips)).toBe('attack')
    expect(resolveExternalClipName('death', clips)).toBe('dead')
    expect(resolveExternalClipName('hit', clips)).toBe('hit')
    expect(resolveExternalClipName('cast', clips)).toBe('special')
  })
})
describe('animações da fauna', () => {
  it('mapeia clips reais e não finge que idle é caminhada', () => {
    const actualClips = ['Idle_A', 'Walking_A', 'Running_A', 'Death_A']
    expect(resolveAnimalClipName('idle', actualClips)).toBe('Idle_A')
    expect(resolveAnimalClipName('walk', actualClips)).toBe('Walking_A')
    expect(resolveAnimalClipName('run', actualClips)).toBe('Running_A')
    expect(resolveAnimalClipName('walk', ['Idle_A'])).toBeUndefined()
    expect(resolveAnimalClipName('run', ['AnimalArmature|Gallop'])).toBe('AnimalArmature|Gallop')
    expect(resolveAnimalClipName('death', ['AnimalArmature|Death'])).toBe('AnimalArmature|Death')
  })
})
describe('seleção de modelos 3D de criaturas', () => {
  it('usa modelos humanoides específicos e mantém criaturas não humanoides no modelo próprio', () => {
    expect(externalHumanoidUrlForModel('cavaleiro')).toBe(EXTERNAL_CHARACTER_URLS.knight)
    expect(externalHumanoidUrlForModel('esqueleto')).toBe(EXTERNAL_CHARACTER_URLS.mummy)
    expect(externalHumanoidUrlForModel('mumia')).toBe(EXTERNAL_CHARACTER_URLS.mummy)
    expect(externalHumanoidUrlForModel('goblin')).toBe(EXTERNAL_CHARACTER_URLS.orc)
    expect(externalHumanoidUrlForModel('goblin', 'goblin-xama')).toBe(EXTERNAL_CHARACTER_URLS.orcShaman)
    expect(externalHumanoidUrlForModel('cavaleiro', 'bandido-emboscador')).toBe(EXTERNAL_CHARACTER_URLS.scout)
    expect(externalHumanoidUrlForModel('cavaleiro', 'cavaleiro-corrompido')).toBe(EXTERNAL_CHARACTER_URLS.knight)
    expect(externalHumanoidUrlForModel('cavaleiro', 'cavaleiro-do-vazio')).toBe(EXTERNAL_CHARACTER_URLS.juggernaut)
    expect(externalHumanoidUrlForModel('diabrete', 'diabrete-de-magma')).toBe(EXTERNAL_CHARACTER_URLS.orcPyromancer)
    expect(externalHumanoidUrlForModel('espectro', 'bruxa-do-lodo')).toBe(EXTERNAL_CHARACTER_URLS.witch)
    expect(externalHumanoidUrlForModel('golem')).toBeUndefined()
    expect(externalHumanoidUrlForModel('gigante')).toBe(EXTERNAL_CHARACTER_URLS.brute)
    expect(externalHumanoidUrlForModel('troll')).toBe(EXTERNAL_CHARACTER_URLS.brute)
    expect(externalHumanoidUrlForModel('espectro')).toBe(EXTERNAL_CHARACTER_URLS.ghost)
    expect(externalHumanoidUrlForModel('yeti')).toBe(EXTERNAL_CHARACTER_URLS.werewolf)
    expect(externalHumanoidUrlForModel('elemental')).toBeUndefined()
    expect(externalHumanoidUrlForModel('serpente')).toBeUndefined()
    expect(externalHumanoidUrlForModel('dragao')).toBeUndefined()
    expect(externalHumanoidUrlForModel('lobo')).toBeUndefined()
  })
})

describe('fauna rara e montarias', () => {
  it('restringe o cavalo branco raro aos habitats frios e permite montar cavalos e burros', () => {
    expect(wildlifeOptionsForBiome('neve').map(animal => animal.id)).toContain('cavalo-branco')
    expect(wildlifeOptionsForBiome('deserto').map(animal => animal.id)).not.toContain('cavalo-branco')
    expect(selectWildlifeForBiome('neve', 0, 0)).toBe('cavalo-branco')
    expect(wildlifeCanBeMounted('cavalo')).toBe(true)
    expect(wildlifeCanBeMounted('burro')).toBe(true)
    expect(wildlifeCanBeMounted('cervo-real')).toBe(false)
  })
})

describe('rotinas e falas ambientais de NPCs', () => {
  it('desloca ferreiros de dia, recolhe-os à noite/temporal e adapta falas ao clima/horário', () => {
    const home = new THREE.Vector3(12, 4, -8)
    const daytime = npcDailyDestination(home, 'forja', 'day', false)
    expect(daytime.toArray()).toEqual([13.1, 4, -8.6])
    expect(npcDailyDestination(home, 'forja', 'night', false).toArray()).toEqual(home.toArray())
    expect(npcDailyDestination(home, 'forja', 'day', true).toArray()).toEqual(home.toArray())
    expect(npcAmbientLine([], { timeOfDay: 0.5, weather: 'chuva' })).toBe('A chuva não vai parar tão cedo.')
    expect(npcAmbientLine([], { timeOfDay: 0.93, weather: 'limpo' })).toBe('A noite esconde mais do que devia.')
  })
})

describe('avisos telegráficos dos inimigos', () => {
  it('mostra setor melee com alcance do acerto e sinaliza ataques à distância', () => {
    const camera = new THREE.PerspectiveCamera()
    const meleeDef = ENEMIES.find(definition => definition.behavior === 'corpo-a-corpo')!
    const melee = new Enemy({ def: meleeDef, level: 2, x: 0, z: 0 })
    try {
      melee.state = 'windup'
      melee.render(0.1, camera)
      expect(melee.attackWarningVisible).toBe(true)
      expect(melee.attackAreaVisible).toBe(true)
      const area = (melee as unknown as { attackArea: THREE.Mesh }).attackArea
      const parameters = (area.geometry as THREE.RingGeometry).parameters
      expect(area.scale.x).toBeCloseTo(meleeDef.attackRange + 1.2)
      expect(parameters.thetaLength).toBeCloseTo(2)
    } finally {
      melee.dispose()
    }

    const rangedDef = ENEMIES.find(definition => definition.behavior === 'distancia')!
    const ranged = new Enemy({ def: rangedDef, level: 2, x: 0, z: 0 })
    try {
      ranged.state = 'windup'
      ranged.render(0.1, camera)
      expect(ranged.attackWarningVisible).toBe(true)
      expect(ranged.attackAreaVisible).toBe(false)
    } finally {
      ranged.dispose()
    }
  })
})
