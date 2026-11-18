import type { LootEntry, Rarity } from '../data/types'
import { ITEMS, itemById } from '../data/itemData'
import { intRange } from '../core/rng'

export type LootDrop = { itemId: string; count: number }

/** Rolls a loot table, applying the player's loot bonus to every chance. */
export function rollLoot(table: LootEntry[], lootBonus = 0): LootDrop[] {
  const drops: LootDrop[] = []
  for (const entry of table) {
    if (!itemById(entry.itemId)) continue
    const chance = Math.min(0.98, entry.chance * (1 + lootBonus))
    if (Math.random() > chance) continue
    const min = entry.min ?? 1
    const max = entry.max ?? min
    drops.push({ itemId: entry.itemId, count: intRange(Math.random, min, max) })
  }
  return drops
}

const RARITY_BY_TIER: Record<number, Rarity[]> = {
  1: ['comum', 'incomum'],
  2: ['incomum', 'raro'],
  3: ['raro', 'epico'],
  4: ['epico', 'lendario'],
  5: ['lendario', 'mitico'],
}

/** Chest contents scale with the chest tier and the level of the region. */
export function rollChest(tier: number, level: number, lootBonus = 0): { gold: number; items: LootDrop[] } {
  const gold = Math.round((12 + tier * 22) * (1 + level * 0.08) * (1 + lootBonus))
  const rarities = RARITY_BY_TIER[Math.min(5, Math.max(1, tier))] ?? ['comum']
  const pool = ITEMS.filter(item => rarities.includes(item.rarity) && (item.kind === 'arma' || item.kind === 'armadura' || item.kind === 'capacete' || item.kind === 'botas' || item.kind === 'anel' || item.kind === 'reliquia' || item.kind === 'material' || item.kind === 'pocao'))
  const items: LootDrop[] = []
  const rolls = 1 + (Math.random() < 0.45 ? 1 : 0) + (tier >= 4 ? 1 : 0)
  for (let i = 0; i < rolls; i += 1) {
    if (!pool.length) break
    const item = pool[Math.floor(Math.random() * pool.length)]
    const count = item.kind === 'material' || item.kind === 'pocao' ? intRange(Math.random, 1, 3) : 1
    const existing = items.find(drop => drop.itemId === item.id)
    if (existing) existing.count += count
    else items.push({ itemId: item.id, count })
  }
  return { gold, items }
}

/** Guaranteed quest rewards plus optional extras. */
export function bossLoot(table: LootEntry[], lootBonus = 0): LootDrop[] {
  const drops: LootDrop[] = []
  for (const entry of table) {
    if (!itemById(entry.itemId)) continue
    if (Math.random() > Math.min(1, entry.chance * (1 + lootBonus))) continue
    drops.push({ itemId: entry.itemId, count: intRange(Math.random, entry.min ?? 1, entry.max ?? 1) })
  }
  return drops
}
