import type { ObjectiveKind, QuestDef, QuestReward } from '../data/types'
import { QUESTS, questById } from '../data/questData'
import type { Inventory } from './inventory'

export type QuestStatus = 'bloqueada' | 'disponivel' | 'ativa' | 'pronta' | 'concluida'

export type QuestState = {
  status: 'ativa' | 'concluida'
  progress: Record<string, number>
}

/** Tracks accepted quests, objective progress and completion. */
export class QuestLog {
  states = new Map<string, QuestState>()
  tracked: string | null = 'principal-01'

  state(id: string): QuestState | undefined {
    return this.states.get(id)
  }

  isCompleted(id: string): boolean {
    return this.states.get(id)?.status === 'concluida'
  }

  statusOf(quest: QuestDef, level: number): QuestStatus {
    const state = this.states.get(quest.id)
    if (state?.status === 'concluida') return 'concluida'
    if (state?.status === 'ativa') return this.objectivesDone(quest) ? 'pronta' : 'ativa'
    if (quest.minLevel && level < quest.minLevel) return 'bloqueada'
    for (const requirement of quest.requires ?? []) {
      if (!this.isCompleted(requirement)) return 'bloqueada'
    }
    return 'disponivel'
  }

  objectivesDone(quest: QuestDef): boolean {
    const state = this.states.get(quest.id)
    if (!state) return false
    return quest.objectives.every(objective => (state.progress[objective.id] ?? 0) >= objective.count)
  }

  accept(id: string, level: number): string | null {
    const quest = questById(id)
    if (!quest) return 'Missão desconhecida.'
    const status = this.statusOf(quest, level)
    if (status === 'concluida') return 'Missão já concluída.'
    if (status === 'ativa' || status === 'pronta') return 'Missão já aceita.'
    if (status === 'bloqueada') return 'Você ainda não pode aceitar esta missão.'
    this.states.set(id, { status: 'ativa', progress: {} })
    if (!this.tracked || this.isCompleted(this.tracked)) this.tracked = id
    return null
  }

  /** Increment matching objectives on every active quest. */
  progress(kind: ObjectiveKind, target: string, amount = 1): string[] {
    const touched: string[] = []
    for (const [id, state] of this.states) {
      if (state.status !== 'ativa') continue
      const quest = questById(id)
      if (!quest) continue
      for (const objective of quest.objectives) {
        if (objective.kind !== kind || objective.target !== target) continue
        const current = state.progress[objective.id] ?? 0
        if (current >= objective.count) continue
        state.progress[objective.id] = Math.min(objective.count, current + amount)
        touched.push(id)
      }
    }
    return touched
  }

  /** Collect objectives read the inventory so picking items up in any order works. */
  syncInventory(inventory: Inventory): void {
    for (const [id, state] of this.states) {
      if (state.status !== 'ativa') continue
      const quest = questById(id)
      if (!quest) continue
      for (const objective of quest.objectives) {
        if (objective.kind !== 'coletar') continue
        const owned = inventory.count(objective.target)
        state.progress[objective.id] = Math.min(objective.count, Math.max(state.progress[objective.id] ?? 0, owned))
      }
    }
  }

  ready(id: string): boolean {
    const quest = questById(id)
    if (!quest) return false
    const state = this.states.get(id)
    if (!state || state.status !== 'ativa') return false
    return this.objectivesDone(quest)
  }

  /** Mark complete and return the reward so the caller can grant it. */
  complete(id: string): QuestReward | null {
    const quest = questById(id)
    const state = this.states.get(id)
    if (!quest || !state || state.status !== 'ativa' || !this.objectivesDone(quest)) return null
    state.status = 'concluida'
    if (this.tracked === id) {
      const next = quest.next ?? this.firstAvailable(quest)
      this.tracked = next ?? null
    }
    return quest.rewards
  }

  private firstAvailable(from: QuestDef): string | null {
    for (const quest of QUESTS) {
      if (!quest.requires?.includes(from.id)) continue
      if (this.states.get(quest.id)?.status === 'ativa') return quest.id
    }
    return null
  }

  active(): QuestDef[] {
    return QUESTS.filter(quest => this.states.get(quest.id)?.status === 'ativa')
  }

  completed(): QuestDef[] {
    return QUESTS.filter(quest => this.states.get(quest.id)?.status === 'concluida')
  }

  available(level: number): QuestDef[] {
    return QUESTS.filter(quest => this.statusOf(quest, level) === 'disponivel')
  }

  /** Quests an NPC can currently offer or close. */
  forNpc(npcId: string, level: number): { offer: QuestDef[]; turnIn: QuestDef[] } {
    const offer: QuestDef[] = []
    const turnIn: QuestDef[] = []
    for (const quest of QUESTS) {
      if (quest.giver !== npcId) continue
      const status = this.statusOf(quest, level)
      if (status === 'disponivel') offer.push(quest)
      if (status === 'pronta') turnIn.push(quest)
    }
    return { offer, turnIn }
  }

  objectiveProgress(questId: string, objectiveId: string): number {
    return this.states.get(questId)?.progress[objectiveId] ?? 0
  }

  marker(): string | undefined {
    if (!this.tracked) return undefined
    return questById(this.tracked)?.marker
  }

  toJSON(): { tracked: string | null; states: Record<string, QuestState> } {
    return { tracked: this.tracked, states: Object.fromEntries([...this.states].map(([id, state]) => [id, { status: state.status, progress: { ...state.progress } }])) }
  }

  load(data: Partial<ReturnType<QuestLog['toJSON']>> | undefined): void {
    this.states.clear()
    if (!data) return
    this.tracked = data.tracked ?? null
    for (const [id, state] of Object.entries(data.states ?? {})) {
      if (!questById(id)) continue
      if (state.status !== 'ativa' && state.status !== 'concluida') continue
      this.states.set(id, { status: state.status, progress: { ...state.progress } })
    }
  }
}
