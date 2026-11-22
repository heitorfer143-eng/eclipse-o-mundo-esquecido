import type { ItemDef, RecipeDef, ShopId } from '../data/types'
import { itemById } from '../data/itemData'
import { RECIPES } from '../data/recipeData'
import type { Inventory } from './inventory'

export type ShopStock = { itemId: string; price: number }

export const SHOP_NAMES: Record<ShopId, string> = {
  ferreiro: 'Forja de Bruno',
  geral: 'Armazém do Jask',
  alquimista: 'Alquimia da Marta',
  comida: 'Cozinha da Lena',
  magia: 'Relicário do Eldrin',
}

const STOCK: Record<ShopId, string[]> = {
  ferreiro: [
    'tool-machado', 'tool-picareta',
    'arma-espada-1', 'arma-espada-2', 'arma-espada-3', 'arma-espadao-2', 'arma-machado-2', 'arma-lanca-2', 'arma-adaga-2', 'arma-adaga-3',
    'armadura-andarilho', 'capacete-andarilho', 'botas-andarilho', 'armadura-sentinela', 'capacete-sentinela', 'botas-sentinela',
    'mat-ferro', 'mat-prata', 'mat-madeira', 'mat-couro',
  ],
  geral: [
    'pocao-vida-1', 'pocao-mana-1', 'pocao-stamina', 'comida-pao', 'comida-fruta', 'comida-sopa',
    'mat-fibra', 'mat-erva', 'mat-madeira', 'mat-couro', 'mat-osso', 'mat-pena',
  ],
  alquimista: [
    'pocao-vida-2', 'pocao-vida-3', 'pocao-mana-1', 'elixir-eclipse',
    'mat-erva', 'mat-cristal', 'mat-essencia', 'mat-seda', 'mat-obsidiana',
  ],
  comida: ['comida-pao', 'comida-sopa', 'comida-peixe', 'comida-carne', 'comida-fruta', 'comida-bolo'],
  magia: ['arma-cajado-2', 'arma-cajado-3', 'arma-arco-2', 'anel-safira', 'anel-rubi', 'pocao-mana-1', 'mat-cristal', 'mat-essencia', 'mat-fragmento'],
}

export function buyPrice(def: ItemDef): number {
  return Math.max(4, Math.round(def.value * 2.4))
}

export function sellPrice(def: ItemDef, plus = 0): number {
  return Math.max(1, Math.round(def.value * (0.45 + plus * 0.08)))
}

export class Shop {
  readonly id: ShopId
  readonly name: string
  readonly stock: ShopStock[]

  constructor(id: ShopId) {
    this.id = id
    this.name = SHOP_NAMES[id]
    this.stock = (STOCK[id] ?? [])
      .map(itemId => ({ itemId, price: 0 }))
      .filter(entry => {
        const def = itemById(entry.itemId)
        if (!def) return false
        entry.price = buyPrice(def)
        return true
      })
  }

  buy(itemId: string, inventory: Inventory, level: number, count = 1): string | null {
    const entry = this.stock.find(stock => stock.itemId === itemId)
    if (!entry) return 'Este item não está à venda.'
    const def = itemById(itemId)
    if (!def) return 'Item inválido.'
    if (def.level && level < def.level) return `Requer nível ${def.level}.`
    const cost = entry.price * count
    if (inventory.gold < cost) return 'Ouro insuficiente.'
    if (!inventory.canAdd(itemId, count)) return 'Inventário cheio.'
    inventory.gold -= cost
    inventory.add(itemId, count)
    return null
  }

  sell(index: number, inventory: Inventory, count = 1): string | null {
    const stack = inventory.stacks[index]
    if (!stack) return 'Item inválido.'
    const def = itemById(stack.id)
    if (!def) return 'Item inválido.'
    const amount = Math.min(count, stack.count)
    const gold = sellPrice(def, stack.plus) * amount
    inventory.removeAt(index, amount)
    inventory.gold += gold
    return null
  }
}

export function shopFor(id: ShopId): Shop {
  return new Shop(id)
}

export function canCraft(recipe: RecipeDef, inventory: Inventory, level: number): string | null {
  if (recipe.minLevel && level < recipe.minLevel) return `Requer nível ${recipe.minLevel}.`
  if (inventory.gold < recipe.gold) return 'Ouro insuficiente.'
  for (const input of recipe.inputs) {
    if (!inventory.has(input.itemId, input.count)) {
      const def = itemById(input.itemId)
      return `Faltam ${input.count - inventory.count(input.itemId)}x ${def?.name ?? input.itemId}.`
    }
  }
  if (!inventory.canAddAfterRemoving(recipe.inputs, recipe.output.itemId, recipe.output.count)) return 'Inventário cheio.'
  return null
}

export function craft(recipe: RecipeDef, inventory: Inventory, level: number): string | null {
  const error = canCraft(recipe, inventory, level)
  if (error) return error
  for (const input of recipe.inputs) inventory.remove(input.itemId, input.count)
  inventory.gold -= recipe.gold
  inventory.add(recipe.output.itemId, recipe.output.count)
  return null
}

export function recipesFor(station: RecipeDef['station']): RecipeDef[] {
  return RECIPES.filter(recipe => recipe.station === station)
}

export const STATION_LABEL: Record<RecipeDef['station'], string> = {
  alquimia: 'Bancada de Alquimia',
  forja: 'Forja',
  fogueira: 'Fogueira',
  bancada: 'Bancada de Trabalho',
}
