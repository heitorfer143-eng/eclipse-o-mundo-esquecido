import type { ItemDef, StatKey, WeaponKind } from '../data/types'
import { itemById } from '../data/itemData'
import { EMPTY_BONUS, type StatBonus } from './stats'

export type EquipSlot = 'arma' | 'armadura' | 'capacete' | 'botas' | 'anel1' | 'anel2' | 'reliquia'

export const EQUIP_SLOTS: EquipSlot[] = ['arma', 'armadura', 'capacete', 'botas', 'anel1', 'anel2', 'reliquia']

export const SLOT_LABEL: Record<EquipSlot, string> = {
  arma: 'Arma',
  armadura: 'Armadura',
  capacete: 'Cabeça',
  botas: 'Botas',
  anel1: 'Anel I',
  anel2: 'Anel II',
  reliquia: 'Relíquia',
}

export type Stack = { id: string; count: number; plus: number }
export type EquipmentPreview = {
  slot: EquipSlot
  selected: Stack
  current: Stack | null
  changes: Partial<Record<StatKey, number>>
}

export type SetBonus = { id: string; name: string; pieces: number; description: string; bonus: StatBonus }

const SET_NAMES: Record<string, string> = {
  andarilho: 'Conjunto do Andarilho',
  sentinela: 'Conjunto do Sentinela',
  eclipse: 'Conjunto do Eclipse',
  aetherion: 'Conjunto de Aetherion',
}

const SET_BONUSES: Record<string, SetBonus[]> = {
  andarilho: [
    { id: 'andarilho-2', name: 'Passo Leve', pieces: 2, description: '+6 de velocidade e +10 de stamina.', bonus: { ...EMPTY_BONUS, velocidade: 6, stamina: 10 } },
    { id: 'andarilho-4', name: 'Instinto de Sobrevivência', pieces: 4, description: '+8% de crítico e +4 de furtividade.', bonus: { ...EMPTY_BONUS, critico: 8, furtividade: 4 } },
  ],
  sentinela: [
    { id: 'sentinela-2', name: 'Muralha Viva', pieces: 2, description: '+12 de defesa.', bonus: { ...EMPTY_BONUS, defesa: 12 } },
    { id: 'sentinela-4', name: 'Juramento de Aster', pieces: 4, description: '+18 de ataque e +40 de vida.', bonus: { ...EMPTY_BONUS, ataque: 18, vida: 40 } },
  ],
  eclipse: [
    { id: 'eclipse-2', name: 'Véu de Sombra', pieces: 2, description: '+14 de magia e +6 de furtividade.', bonus: { ...EMPTY_BONUS, magia: 14, furtividade: 6 } },
    { id: 'eclipse-4', name: 'Fome do Eclipse', pieces: 4, description: '+8% de roubo de vida e +10 de crítico.', bonus: { ...EMPTY_BONUS, rouboDeVida: 8, critico: 10 } },
  ],
  aetherion: [
    { id: 'aetherion-2', name: 'Herança dos Sete', pieces: 2, description: '+25 de ataque e +25 de magia.', bonus: { ...EMPTY_BONUS, ataque: 25, magia: 25 } },
    { id: 'aetherion-4', name: 'Luz que Resta', pieces: 4, description: '+120 de vida, +40 de mana e +10 de crítico.', bonus: { ...EMPTY_BONUS, vida: 120, mana: 40, critico: 10 } },
  ],
}

export function isEquipment(def: ItemDef): boolean {
  return def.kind === 'arma' || def.kind === 'armadura' || def.kind === 'capacete' || def.kind === 'botas' || def.kind === 'anel' || def.kind === 'reliquia'
}

export function slotFor(def: ItemDef): EquipSlot | null {
  switch (def.kind) {
    case 'arma': return 'arma'
    case 'armadura': return 'armadura'
    case 'capacete': return 'capacete'
    case 'botas': return 'botas'
    case 'anel': return 'anel1'
    case 'reliquia': return 'reliquia'
    default: return null
  }
}

/** Enhancement multiplier: each level adds 9% to the item's stats. */
export function plusMultiplier(plus: number): number {
  return 1 + Math.max(0, Math.min(5, plus)) * 0.09
}

export function stackValue(stack: Stack): number {
  const def = itemById(stack.id)
  if (!def) return 0
  return Math.round(def.value * plusMultiplier(stack.plus))
}

export function statLine(def: ItemDef, plus = 0): string[] {
  if (!def.stats) return []
  const lines: string[] = []
  const mult = plusMultiplier(plus)
  for (const [key, value] of Object.entries(def.stats) as [StatKey, number][]) {
    const scaled = Math.round(value * mult)
    if (scaled === 0) continue
    const label: Record<StatKey, string> = {
      ataque: 'Ataque',
      defesa: 'Defesa',
      vida: 'Vida',
      mana: 'Mana',
      stamina: 'Stamina',
      critico: 'Crítico',
      velocidade: 'Velocidade',
      magia: 'Magia',
      furtividade: 'Furtividade',
      rouboDeVida: 'Roubo de vida',
    }
    const percent = key === 'critico' || key === 'furtividade' || key === 'rouboDeVida'
    lines.push(`+${scaled}${percent ? '%' : ''} ${label[key]}`)
  }
  return lines
}

/** Player inventory: stackable consumables plus seven equipment slots with set bonuses. */
export class Inventory {
  stacks: Stack[] = []
  equipment: Record<EquipSlot, Stack | null> = { arma: null, armadura: null, capacete: null, botas: null, anel1: null, anel2: null, reliquia: null }
  gold = 0
  capacity = 42
  onChanged?: () => void

  private changed(): void {
    this.onChanged?.()
  }

  /** Clear the bag and every equipment slot (used when a new adventure starts). */
  reset(): void {
    this.stacks.length = 0
    for (const slot of EQUIP_SLOTS) this.equipment[slot] = null
    this.gold = 0
  }

  count(id: string): number {
    let total = 0
    for (const stack of this.stacks) if (stack.id === id) total += stack.count
    return total
  }

  has(id: string, count = 1): boolean {
    return this.count(id) >= count
  }

  private canAddToStacks(stacks: Stack[], id: string, count: number, plus: number): boolean {
    if (count <= 0) return true
    const def = itemById(id)
    if (!def) return false
    const maxStack = def.stack ?? (isEquipment(def) ? 1 : 20)
    let remaining = count
    if (maxStack > 1) {
      for (const stack of stacks) {
        if (stack.id !== id || stack.plus !== plus) continue
        remaining -= Math.max(0, maxStack - stack.count)
        if (remaining <= 0) return true
      }
    }
    return Math.ceil(remaining / maxStack) <= Math.max(0, this.capacity - stacks.length)
  }

  /** Whether all items fit, accounting for available room in matching stacks. */
  canAdd(id: string, count = 1, plus = 0): boolean {
    return this.canAddToStacks(this.stacks, id, count, plus)
  }

  /** Whether a whole reward batch fits, including slots created by earlier rewards in the batch. */
  canAddItems(items: readonly { itemId: string; count: number; plus?: number }[]): boolean {
    const projected = this.stacks.map(stack => ({ ...stack }))
    for (const item of items) {
      const plus = item.plus ?? 0
      if (!this.canAddToStacks(projected, item.itemId, item.count, plus)) return false
      const def = itemById(item.itemId)
      if (!def || item.count <= 0) continue
      const maxStack = def.stack ?? (isEquipment(def) ? 1 : 20)
      let remaining = item.count
      if (maxStack > 1) {
        for (const stack of projected) {
          if (stack.id !== item.itemId || stack.plus !== plus) continue
          const added = Math.min(remaining, Math.max(0, maxStack - stack.count))
          stack.count += added
          remaining -= added
          if (remaining <= 0) break
        }
      }
      while (remaining > 0) {
        const added = Math.min(maxStack, remaining)
        projected.push({ id: item.itemId, count: added, plus })
        remaining -= added
      }
    }
    return true
  }

  /** Preflight an addition after the supplied materials have been consumed. */
  canAddAfterRemoving(removals: { itemId: string; count: number }[], id: string, count = 1, plus = 0): boolean {
    const remainingStacks = this.stacks.map(stack => ({ ...stack }))
    for (const removal of removals) {
      let remaining = removal.count
      for (let index = remainingStacks.length - 1; index >= 0 && remaining > 0; index -= 1) {
        const stack = remainingStacks[index]
        if (stack.id !== removal.itemId) continue
        const taken = Math.min(stack.count, remaining)
        stack.count -= taken
        remaining -= taken
        if (stack.count <= 0) remainingStacks.splice(index, 1)
      }
      if (remaining > 0) return false
    }
    return this.canAddToStacks(remainingStacks, id, count, plus)
  }

  /** Adds items, returning how many could not fit. */
  add(id: string, count = 1, plus = 0): number {
    const def = itemById(id)
    if (!def) return count
    const maxStack = def.stack ?? (isEquipment(def) ? 1 : 20)
    let remaining = count
    if (maxStack > 1) {
      for (const stack of this.stacks) {
        if (remaining <= 0) break
        if (stack.id !== id || stack.plus !== plus) continue
        const space = maxStack - stack.count
        if (space <= 0) continue
        const moved = Math.min(space, remaining)
        stack.count += moved
        remaining -= moved
      }
    }
    while (remaining > 0 && this.stacks.length < this.capacity) {
      const moved = Math.min(maxStack, remaining)
      this.stacks.push({ id, count: moved, plus })
      remaining -= moved
    }
    if (remaining !== count) this.changed()
    return remaining
  }

  remove(id: string, count = 1): boolean {
    if (!this.has(id, count)) return false
    let remaining = count
    for (let i = this.stacks.length - 1; i >= 0 && remaining > 0; i -= 1) {
      const stack = this.stacks[i]
      if (stack.id !== id) continue
      const taken = Math.min(stack.count, remaining)
      stack.count -= taken
      remaining -= taken
      if (stack.count <= 0) this.stacks.splice(i, 1)
    }
    this.changed()
    return true
  }

  removeAt(index: number, count = 1): boolean {
    const stack = this.stacks[index]
    if (!stack) return false
    stack.count -= count
    if (stack.count <= 0) this.stacks.splice(index, 1)
    this.changed()
    return true
  }

  slotForIndex(index: number): EquipSlot | null {
    const stack = this.stacks[index]
    if (!stack) return null
    const def = itemById(stack.id)
    if (!def) return null
    const slot = slotFor(def)
    if (!slot) return null
    if (slot === 'anel1' && this.equipment.anel1) return 'anel2'
    return slot
  }

  /** Direct attribute comparison for the selected bag item and its destination slot. */
  previewEquipIndex(index: number): EquipmentPreview | null {
    const selected = this.stacks[index]
    if (!selected) return null
    const def = itemById(selected.id)
    const slot = def && isEquipment(def) ? this.slotForIndex(index) : null
    if (!def || !slot) return null
    const current = this.equipment[slot]
    const currentDef = current ? itemById(current.id) : undefined
    const keys = new Set<StatKey>([
      ...Object.keys(def.stats ?? {}) as StatKey[],
      ...Object.keys(currentDef?.stats ?? {}) as StatKey[],
    ])
    const changes: Partial<Record<StatKey, number>> = {}
    for (const key of keys) {
      const selectedValue = Math.round((def.stats?.[key] ?? 0) * plusMultiplier(selected.plus))
      const currentValue = Math.round((currentDef?.stats?.[key] ?? 0) * plusMultiplier(current?.plus ?? 0))
      const delta = selectedValue - currentValue
      if (delta !== 0) changes[key] = delta
    }
    return { slot, selected: { ...selected }, current: current ? { ...current } : null, changes }
  }

  /** Equip an item from a bag slot. Returns an error message, or null on success. */
  equipIndex(index: number, level: number): string | null {
    const stack = this.stacks[index]
    if (!stack) return 'Item não encontrado.'
    const def = itemById(stack.id)
    if (!def) return 'Item inválido.'
    if (!isEquipment(def)) return 'Este item não pode ser equipado.'
    if (def.level && level < def.level) return `Requer nível ${def.level}.`
    const slot = this.slotForIndex(index)
    if (!slot) return 'Sem espaço para equipar.'
    const previous = this.equipment[slot]
    this.stacks.splice(index, 1)
    this.equipment[slot] = { id: stack.id, count: 1, plus: stack.plus }
    if (previous) this.add(previous.id, 1, previous.plus)
    this.changed()
    return null
  }

  unequip(slot: EquipSlot): string | null {
    const equipped = this.equipment[slot]
    if (!equipped) return 'Nada equipado.'
    if (this.add(equipped.id, 1, equipped.plus) > 0) return 'Inventário cheio.'
    this.equipment[slot] = null
    this.changed()
    return null
  }

  equippedDef(slot: EquipSlot): ItemDef | undefined {
    const stack = this.equipment[slot]
    return stack ? itemById(stack.id) : undefined
  }

  weapon(): WeaponKind {
    return this.equippedDef('arma')?.weapon ?? 'espada'
  }

  weaponElement(): ItemDef['element'] {
    return this.equippedDef('arma')?.element
  }

  /** Aggregated stat bonuses from gear and active set bonuses. */
  bonus(): StatBonus {
    const total: StatBonus = { ...EMPTY_BONUS }
    for (const slot of EQUIP_SLOTS) {
      const stack = this.equipment[slot]
      if (!stack) continue
      const def = itemById(stack.id)
      if (!def?.stats) continue
      const mult = plusMultiplier(stack.plus)
      for (const [key, value] of Object.entries(def.stats) as [StatKey, number][]) {
        total[key] += Math.round(value * mult)
      }
    }
    for (const bonus of this.activeSetBonuses()) {
      for (const key of Object.keys(total) as StatKey[]) {
        total[key] += bonus.bonus[key]
      }
    }
    return total
  }

  setCounts(): Map<string, number> {
    const counts = new Map<string, number>()
    for (const slot of EQUIP_SLOTS) {
      const stack = this.equipment[slot]
      if (!stack) continue
      const def = itemById(stack.id)
      if (!def?.set) continue
      counts.set(def.set, (counts.get(def.set) ?? 0) + 1)
    }
    return counts
  }

  activeSetBonuses(): SetBonus[] {
    const active: SetBonus[] = []
    for (const [setId, count] of this.setCounts()) {
      const bonuses = SET_BONUSES[setId] ?? []
      for (const bonus of bonuses) if (count >= bonus.pieces) active.push(bonus)
    }
    return active
  }

  /** Progress of every set the player owns at least one piece of, for the UI. */
  setProgress(): { id: string; name: string; equipped: number; total: number; bonuses: SetBonus[] }[] {
    const counts = this.setCounts()
    const owned = new Set<string>()
    for (const stack of this.stacks) {
      const def = itemById(stack.id)
      if (def?.set) owned.add(def.set)
    }
    for (const id of counts.keys()) owned.add(id)
    return [...owned].map(id => ({
      id,
      name: SET_NAMES[id] ?? id,
      equipped: counts.get(id) ?? 0,
      total: 4,
      bonuses: SET_BONUSES[id] ?? [],
    }))
  }

  /** Enhancement cost in gold and materials for the next level. */
  upgradeCost(stack: Stack): { gold: number; material: string; amount: number } | null {
    if (stack.plus >= 5) return null
    const def = itemById(stack.id)
    if (!def || !isEquipment(def)) return null
    const tier = stack.plus + 1
    return {
      gold: Math.round(def.value * 0.6 * tier),
      material: def.rarity === 'lendario' || def.rarity === 'mitico' ? 'mat-mithril' : tier >= 4 ? 'mat-prata' : 'mat-ferro',
      amount: tier + 1,
    }
  }

  canUpgrade(stack: Stack): boolean {
    const cost = this.upgradeCost(stack)
    if (!cost) return false
    return this.gold >= cost.gold && this.has(cost.material, cost.amount)
  }

  upgradeStack(stack: Stack): string | null {
    const cost = this.upgradeCost(stack)
    if (!cost) return 'Este item já está no máximo.'
    if (this.gold < cost.gold) return 'Ouro insuficiente.'
    if (!this.has(cost.material, cost.amount)) return 'Materiais insuficientes.'
    this.gold -= cost.gold
    this.remove(cost.material, cost.amount)
    stack.plus += 1
    this.changed()
    return null
  }

  /** Use a consumable on the player; returns a description of what happened. */
  toJSON(): { stacks: Stack[]; equipment: Record<EquipSlot, Stack | null>; gold: number } {
    return { stacks: this.stacks.map(s => ({ ...s })), equipment: { ...this.equipment }, gold: this.gold }
  }

  load(data: Partial<ReturnType<Inventory['toJSON']>> | undefined): void {
    if (!data) return
    this.stacks = Array.isArray(data.stacks) ? data.stacks.filter(s => itemById(s.id)).map(s => ({ id: s.id, count: Math.max(1, Math.min(99, s.count)), plus: Math.max(0, Math.min(5, s.plus ?? 0)) })) : []
    const equipment = data.equipment
    if (equipment) {
      for (const slot of EQUIP_SLOTS) {
        const stack = equipment[slot]
        this.equipment[slot] = stack && itemById(stack.id) ? { id: stack.id, count: 1, plus: Math.max(0, Math.min(5, stack.plus ?? 0)) } : null
      }
    }
    this.gold = Math.max(0, Math.round(data.gold ?? 0))
  }

  totalItems(): number {
    return this.stacks.reduce((sum, stack) => sum + stack.count, 0)
  }
}
