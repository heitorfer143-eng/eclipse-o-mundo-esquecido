import type { RecipeDef } from './types'

/**
 * Crafting book for Eclipse: O Mundo Esquecido.
 *
 * Potions are brewed at the alchemy bench, food is cooked over a campfire, weapons and armour are
 * forged, and everything else (refined materials) is assembled on the workbench.
 */
export const RECIPES: RecipeDef[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // Alquimia — poções
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'receita-pocao-vida-1',
    name: 'Preparar Poção de Vida Menor',
    output: { itemId: 'pocao-vida-1', count: 1 },
    inputs: [
      { itemId: 'mat-erva', count: 2 },
      { itemId: 'mat-fibra', count: 1 },
    ],
    gold: 5,
    station: 'alquimia',
    minLevel: 1,
  },
  {
    id: 'receita-pocao-vida-2',
    name: 'Preparar Poção de Vida',
    output: { itemId: 'pocao-vida-2', count: 1 },
    inputs: [
      { itemId: 'mat-erva', count: 4 },
      { itemId: 'mat-fibra', count: 2 },
      { itemId: 'mat-cristal', count: 1 },
    ],
    gold: 20,
    station: 'alquimia',
    minLevel: 8,
  },
  {
    id: 'receita-pocao-vida-3',
    name: 'Preparar Poção de Vida Maior',
    output: { itemId: 'pocao-vida-3', count: 1 },
    inputs: [
      { itemId: 'mat-erva', count: 6 },
      { itemId: 'mat-cristal', count: 2 },
      { itemId: 'mat-essencia', count: 1 },
    ],
    gold: 60,
    station: 'alquimia',
    minLevel: 18,
  },
  {
    id: 'receita-pocao-mana',
    name: 'Destilar Poção de Mana',
    output: { itemId: 'pocao-mana-1', count: 1 },
    inputs: [
      { itemId: 'mat-cristal', count: 2 },
      { itemId: 'mat-erva', count: 1 },
      { itemId: 'mat-fibra', count: 1 },
    ],
    gold: 25,
    station: 'alquimia',
    minLevel: 6,
  },
  {
    id: 'receita-pocao-stamina',
    name: 'Preparar Elixir de Vigor',
    output: { itemId: 'pocao-stamina', count: 1 },
    inputs: [
      { itemId: 'mat-erva', count: 2 },
      { itemId: 'mat-pena', count: 1 },
      { itemId: 'mat-fibra', count: 1 },
    ],
    gold: 15,
    station: 'alquimia',
    minLevel: 4,
  },
  {
    id: 'receita-elixir-eclipse',
    name: 'Destilar Elixir do Eclipse',
    output: { itemId: 'elixir-eclipse', count: 1 },
    inputs: [
      { itemId: 'mat-fragmento', count: 1 },
      { itemId: 'mat-cristal', count: 3 },
      { itemId: 'mat-essencia', count: 3 },
      { itemId: 'mat-erva', count: 5 },
    ],
    gold: 400,
    station: 'alquimia',
    minLevel: 30,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Fogueira — comida
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'receita-pao',
    name: 'Assar Pão de Centeio',
    output: { itemId: 'comida-pao', count: 2 },
    inputs: [
      { itemId: 'mat-fibra', count: 3 },
      { itemId: 'mat-madeira', count: 1 },
    ],
    gold: 0,
    station: 'fogueira',
    minLevel: 1,
  },
  {
    id: 'receita-sopa',
    name: 'Cozinhar Sopa de Legumes',
    output: { itemId: 'comida-sopa', count: 1 },
    inputs: [
      { itemId: 'comida-fruta', count: 3 },
      { itemId: 'mat-erva', count: 2 },
      { itemId: 'mat-madeira', count: 1 },
    ],
    gold: 5,
    station: 'fogueira',
    minLevel: 3,
  },
  {
    id: 'receita-peixe',
    name: 'Assar Peixe na Brasa',
    output: { itemId: 'comida-peixe', count: 3 },
    inputs: [
      { itemId: 'comida-peixe', count: 2 },
      { itemId: 'mat-erva', count: 1 },
      { itemId: 'mat-madeira', count: 1 },
    ],
    gold: 3,
    station: 'fogueira',
    minLevel: 2,
  },
  {
    id: 'receita-carne',
    name: 'Preparar Carne de Caça',
    output: { itemId: 'comida-carne', count: 3 },
    inputs: [
      { itemId: 'comida-carne', count: 2 },
      { itemId: 'mat-erva', count: 2 },
      { itemId: 'mat-madeira', count: 2 },
    ],
    gold: 10,
    station: 'fogueira',
    minLevel: 8,
  },
  {
    id: 'receita-bolo',
    name: 'Assar Bolo de Mel',
    output: { itemId: 'comida-bolo', count: 1 },
    inputs: [
      { itemId: 'mat-fibra', count: 2 },
      { itemId: 'comida-fruta', count: 3 },
      { itemId: 'mat-erva', count: 1 },
    ],
    gold: 25,
    station: 'fogueira',
    minLevel: 12,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Forja — armas
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'receita-espada-2',
    name: 'Forjar Espada do Viajante',
    output: { itemId: 'arma-espada-2', count: 1 },
    inputs: [
      { itemId: 'mat-ferro', count: 4 },
      { itemId: 'mat-madeira', count: 1 },
      { itemId: 'mat-couro', count: 1 },
    ],
    gold: 30,
    station: 'forja',
    minLevel: 7,
  },
  {
    id: 'receita-arco-2',
    name: 'Forjar Arco Curto',
    output: { itemId: 'arma-arco-2', count: 1 },
    inputs: [
      { itemId: 'mat-madeira', count: 4 },
      { itemId: 'mat-fibra', count: 3 },
      { itemId: 'mat-couro', count: 1 },
    ],
    gold: 25,
    station: 'forja',
    minLevel: 7,
  },
  {
    id: 'receita-lanca-3',
    name: 'Forjar Lança do Sentinela',
    output: { itemId: 'arma-lanca-3', count: 1 },
    inputs: [
      { itemId: 'mat-prata', count: 3 },
      { itemId: 'mat-madeira', count: 3 },
      { itemId: 'mat-ferro', count: 2 },
    ],
    gold: 80,
    station: 'forja',
    minLevel: 13,
  },
  {
    id: 'receita-espadao-3',
    name: 'Forjar Decepa-Gigantes',
    output: { itemId: 'arma-espadao-3', count: 1 },
    inputs: [
      { itemId: 'mat-prata', count: 4 },
      { itemId: 'mat-ferro', count: 4 },
      { itemId: 'mat-couro', count: 2 },
    ],
    gold: 95,
    station: 'forja',
    minLevel: 13,
  },
  {
    id: 'receita-machado-4',
    name: 'Forjar Machado do Titã',
    output: { itemId: 'arma-machado-4', count: 1 },
    inputs: [
      { itemId: 'mat-mithril', count: 3 },
      { itemId: 'mat-obsidiana', count: 2 },
      { itemId: 'mat-madeira', count: 3 },
    ],
    gold: 220,
    station: 'forja',
    minLevel: 19,
  },
  {
    id: 'receita-cajado-4',
    name: 'Forjar Cajado do Arquimago',
    output: { itemId: 'arma-cajado-4', count: 1 },
    inputs: [
      { itemId: 'mat-mithril', count: 2 },
      { itemId: 'mat-cristal', count: 3 },
      { itemId: 'mat-madeira', count: 2 },
    ],
    gold: 240,
    station: 'forja',
    minLevel: 19,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Forja — armaduras
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'receita-armadura-andarilho',
    name: 'Costurar Manto do Andarilho',
    output: { itemId: 'armadura-andarilho', count: 1 },
    inputs: [
      { itemId: 'mat-couro', count: 4 },
      { itemId: 'mat-fibra', count: 3 },
    ],
    gold: 10,
    station: 'forja',
    minLevel: 3,
  },
  {
    id: 'receita-capacete-andarilho',
    name: 'Costurar Capuz do Andarilho',
    output: { itemId: 'capacete-andarilho', count: 1 },
    inputs: [
      { itemId: 'mat-couro', count: 2 },
      { itemId: 'mat-fibra', count: 2 },
    ],
    gold: 5,
    station: 'forja',
    minLevel: 3,
  },
  {
    id: 'receita-armadura-sentinela',
    name: 'Forjar Peitoral do Sentinela',
    output: { itemId: 'armadura-sentinela', count: 1 },
    inputs: [
      { itemId: 'mat-ferro', count: 6 },
      { itemId: 'mat-prata', count: 3 },
      { itemId: 'mat-couro', count: 4 },
    ],
    gold: 140,
    station: 'forja',
    minLevel: 12,
  },
  {
    id: 'receita-botas-sentinela',
    name: 'Forjar Grevas do Sentinela',
    output: { itemId: 'botas-sentinela', count: 1 },
    inputs: [
      { itemId: 'mat-ferro', count: 4 },
      { itemId: 'mat-couro', count: 3 },
      { itemId: 'mat-prata', count: 1 },
    ],
    gold: 60,
    station: 'forja',
    minLevel: 12,
  },
  {
    id: 'receita-armadura-eclipse',
    name: 'Tecer Vestes do Eclipse',
    output: { itemId: 'armadura-eclipse', count: 1 },
    inputs: [
      { itemId: 'mat-seda', count: 6 },
      { itemId: 'mat-obsidiana', count: 3 },
      { itemId: 'mat-cristal', count: 3 },
    ],
    gold: 360,
    station: 'forja',
    minLevel: 24,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Bancada — refino de materiais
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'receita-seda',
    name: 'Fiar Seda de Aranha',
    output: { itemId: 'mat-seda', count: 2 },
    inputs: [
      { itemId: 'mat-fibra', count: 4 },
      { itemId: 'mat-pena', count: 1 },
    ],
    gold: 12,
    station: 'bancada',
    minLevel: 6,
  },
  {
    id: 'receita-obsidiana',
    name: 'Fundir Obsidiana',
    output: { itemId: 'mat-obsidiana', count: 1 },
    inputs: [
      { itemId: 'mat-essencia', count: 2 },
      { itemId: 'mat-cristal', count: 1 },
      { itemId: 'mat-osso', count: 2 },
    ],
    gold: 30,
    station: 'bancada',
    minLevel: 12,
  },
  {
    id: 'receita-liga-mithril',
    name: 'Forjar Liga de Mithril',
    output: { itemId: 'mat-mithril', count: 1 },
    inputs: [
      { itemId: 'mat-prata', count: 2 },
      { itemId: 'mat-ferro', count: 3 },
      { itemId: 'mat-essencia', count: 1 },
    ],
    gold: 45,
    station: 'bancada',
    minLevel: 15,
  },
  {
    id: 'receita-fragmento',
    name: 'Estabilizar Fragmento do Eclipse',
    output: { itemId: 'mat-fragmento', count: 1 },
    inputs: [
      { itemId: 'mat-obsidiana', count: 3 },
      { itemId: 'mat-mithril', count: 1 },
      { itemId: 'mat-cristal', count: 2 },
    ],
    gold: 200,
    station: 'bancada',
    minLevel: 28,
  },
]

const BY_ID = new Map(RECIPES.map(recipe => [recipe.id, recipe]))

export function recipeById(id: string): RecipeDef | undefined {
  return BY_ID.get(id)
}
