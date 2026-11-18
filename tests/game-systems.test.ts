import { describe, expect, it } from 'vitest'
import { SaveStore } from '../src/engine/save'
import { NPCS } from '../src/game/data/npcData'
import { QUESTS, questById } from '../src/game/data/questData'
import { DialogueRunner } from '../src/game/systems/dialogue'
import { QuestLog } from '../src/game/systems/quests'
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
    const seed = 73_102_991

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
