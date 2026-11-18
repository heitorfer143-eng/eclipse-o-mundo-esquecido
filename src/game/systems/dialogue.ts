import type { DialogueAction, DialogueNode, NpcDef } from '../data/types'
import { questById } from '../data/questData'
import type { QuestLog } from './quests'

export type ChoiceView = {
  text: string
  action?: DialogueAction
  quest?: string
  next?: string
  close: boolean
}

export type SelectResult = {
  action?: DialogueAction
  quest?: string
  close: boolean
  next?: string
}

/**
 * Walks an NPC dialogue tree, injecting quest actions ("Aceitar", "Concluir") into the greeting
 * based on the current quest log so writers do not have to duplicate nodes per quest state.
 */
export class DialogueRunner {
  npc: NpcDef | null = null
  nodeId: string | null = null

  open(npc: NpcDef, quests: QuestLog, level: number): void {
    this.npc = npc
    this.nodeId = npc.root
    void quests
    void level
  }

  close(): void {
    this.npc = null
    this.nodeId = null
  }

  get node(): DialogueNode | undefined {
    if (!this.npc || !this.nodeId) return undefined
    return this.npc.nodes[this.nodeId]
  }

  choices(quests: QuestLog, level: number): ChoiceView[] {
    const node = this.node
    if (!node || !this.npc) return []
    const views: ChoiceView[] = []
    for (const choice of node.choices ?? []) {
      if (choice.action === 'aceitar' || choice.action === 'concluir') {
        const quest = choice.quest ? questById(choice.quest) : undefined
        if (!quest) continue
        const status = quests.statusOf(quest, level)
        if (choice.action === 'aceitar' && status !== 'disponivel') continue
        if (choice.action === 'concluir' && status !== 'pronta') continue
        views.push({
          text: choice.action === 'aceitar' ? `Aceitar: ${quest.name}` : `Concluir: ${quest.name}`,
          action: choice.action,
          quest: quest.id,
          close: false,
        })
        continue
      }
      views.push({ text: choice.text, action: choice.action, quest: choice.quest, next: choice.next, close: !choice.next })
    }
    // Every dialogue can be closed.
    if (!views.some(view => view.action === 'fechar')) views.push({ text: 'Até logo.', close: true })
    return views
  }

  select(index: number, quests: QuestLog, level: number): SelectResult {
    const views = this.choices(quests, level)
    const choice = views[index]
    if (!choice) return { close: true }
    if (choice.action === 'fechar') return { close: true }
    if (choice.action === 'aceitar' || choice.action === 'concluir' || choice.action === 'loja' || choice.action === 'curar' || choice.action === 'forja' || choice.action === 'aprender') {
      return { action: choice.action, quest: choice.quest, close: choice.action === 'aceitar' || choice.action === 'concluir' ? false : true }
    }
    if (choice.next) {
      this.nodeId = choice.next
      return { close: false, next: choice.next }
    }
    return { close: true }
  }
}
