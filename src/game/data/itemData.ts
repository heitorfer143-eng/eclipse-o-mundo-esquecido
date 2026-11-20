import type { ItemDef, ItemKind, Rarity, WeaponKind } from './types'

const RARITY_ORDER: Rarity[] = ['comum', 'incomum', 'raro', 'epico', 'lendario']
const RARITY_VALUE: Record<Rarity, number> = { comum: 1, incomum: 1.8, raro: 3.2, epico: 5.5, lendario: 9, mitico: 14 }

type WeaponRow = {
  kind: WeaponKind
  names: string[]
  /** Base attack at tier 1; each tier multiplies by `growth`. */
  attack: number
  growth: number
  crit: number
  speed: number
  magic?: number
  value: number
  descriptions: string[]
  element?: ItemDef['element']
}

const WEAPON_ROWS: WeaponRow[] = [
  {
    kind: 'espada',
    names: ['Espada Enferrujada', 'Espada do Viajante', 'Lâmina de Prata', 'Espada do Alvorecer', 'Lâmina do Eclipse'],
    attack: 9,
    growth: 1.55,
    crit: 6,
    speed: 1,
    value: 40,
    descriptions: [
      'Ferro gasto pela umidade das florestas de Aetherion. Ainda corta.',
      'Equilibrada e confiável, a escolha de quem precisa sobreviver ao primeiro dia.',
      'Forjada com prata das montanhas geladas; brilha quando há magia por perto.',
      'A lâmina que os antigos erguiam contra a escuridão antes do Eclipse.',
      'Dizem que esta espada bebeu a luz de uma das sete entidades.',
    ],
  },
  {
    kind: 'espadao',
    names: ['Espadão Rachado', 'Montante do Guarda', 'Decepa-Gigantes', 'Grande Lâmina de Aetherion', 'Devoradora de Almas'],
    attack: 15,
    growth: 1.6,
    crit: 4,
    speed: 0.72,
    value: 60,
    descriptions: [
      'Pesado demais para um soldado comum, leve o bastante para um herói teimoso.',
      'A guarda da cidade ainda usa este modelo para conter motins.',
      'Um único golpe derruba uma árvore centenária — ou um troll.',
      'Forjada nas forjas reais, temperada com o fogo do Eclipse.',
      'Aço negro que sussurra nomes de quem já matou.',
    ],
  },
  {
    kind: 'adaga',
    names: ['Adaga Simples', 'Punhal do Ladrão', 'Presas Gêmeas', 'Adaga Sombria', 'Sussurro da Noite'],
    attack: 6,
    growth: 1.5,
    crit: 15,
    speed: 1.45,
    value: 30,
    descriptions: [
      'Uma ferramenta de cozinha que virou arma de sobrevivência.',
      'Leve, silenciosa e com marcas de muitos bolsos alheios.',
      'Duas lâminas curvas que dançam nas mãos de quem sabe esperar.',
      'Corta a luz antes de cortar a carne.',
      'Ninguém ouve o golpe. Só o silêncio depois dele.',
    ],
  },
  {
    kind: 'lanca',
    names: ['Lança de Caça', 'Pique da Milícia', 'Lança do Sentinela', 'Perfuradora Celeste', 'Lança do Eclipse'],
    attack: 11,
    growth: 1.55,
    crit: 7,
    speed: 0.92,
    value: 45,
    descriptions: [
      'Uma haste de madeira com ponta de pedra lascada.',
      'Formação cerrada, escudos à frente, lanças ao alto.',
      'Alcança o inimigo antes que ele sonhe em tocar você.',
      'Dizem que foi cravada no céu para segurar o sol.',
      'A ponta ainda brilha com a luz roubada no dia do Eclipse.',
    ],
  },
  {
    kind: 'arco',
    names: ['Arco de Caça', 'Arco Curto', 'Arco Longo Élfico', 'Arco do Vendaval', 'Chuva de Estrelas'],
    attack: 8,
    growth: 1.55,
    crit: 10,
    speed: 1.1,
    value: 50,
    descriptions: [
      'Corda de tendão, madeira de freixo, mira de quem tem fome.',
      'Compacto o bastante para atirar de dentro da mata.',
      'Trabalho élfico: leve como uma folha, preciso como o inverno.',
      'Cada flecha assobia como uma tempestade de verão.',
      'Setas de luz que caem como meteoros sobre o campo de batalha.',
    ],
  },
  {
    kind: 'cajado',
    names: ['Cajado de Aprendiz', 'Cajado de Carvalho', 'Cetro de Cristal', 'Cajado do Arquimago', 'Cajado do Vazio'],
    attack: 7,
    growth: 1.5,
    crit: 6,
    speed: 1,
    magic: 6,
    value: 55,
    descriptions: [
      'Madeira torta com um cristal barato amarrado na ponta.',
      'O carvalho guarda memória; basta saber pedir.',
      'Cristal puro que amplifica cada gesto do conjurador.',
      'Pertenceu ao último arquimago de Aetherion antes da queda.',
      'Não conjura magia: abre um buraco por onde ela entra.',
    ],
  },
  {
    kind: 'machado',
    names: ['Machado de Lenhador', 'Machado de Guerra', 'Cutelo do Carrasco', 'Machado do Titã', 'Ruína de Mundos'],
    attack: 13,
    growth: 1.6,
    crit: 5,
    speed: 0.82,
    value: 55,
    descriptions: [
      'Corta lenha, corta goblins. A mesma técnica.',
      'Aço largo, cabo reforçado, sem sutilezas.',
      'O peso faz metade do trabalho; o resto é coragem.',
      'Arrancado das mãos de um gigante antigo nas montanhas.',
      'Quando este machado cai, o chão aprende a tremer.',
    ],
  },
]

function buildWeapons(): ItemDef[] {
  const out: ItemDef[] = []
  for (const row of WEAPON_ROWS) {
    row.names.forEach((name, index) => {
      const rarity = RARITY_ORDER[index]
      const attack = Math.round(row.attack * row.growth ** index)
      const stats: Record<string, number> = { ataque: attack, critico: row.crit + index * 2 }
      if (row.magic) stats.magia = Math.round(row.magic * (1 + index * 0.9))
      stats.velocidade = Math.round((row.speed - 1) * 100)
      out.push({
        id: `arma-${row.kind}-${index + 1}`,
        name,
        kind: 'arma',
        rarity,
        value: Math.round(row.value * RARITY_VALUE[rarity] ** 1.4),
        description: row.descriptions[index],
        stats,
        weapon: row.kind,
        element: row.element,
        level: index * 6 + 1,
        stack: 1,
      })
    })
  }
  return out
}

type SetPiece = { slot: 'armadura' | 'capacete' | 'botas' | 'anel'; name: string; defense: number; stats: Record<string, number>; description: string }

const ARMOR_SETS: { id: string; rarity: Rarity; level: number; pieces: SetPiece[] }[] = [
  {
    id: 'andarilho',
    rarity: 'incomum',
    level: 1,
    pieces: [
      { slot: 'armadura', name: 'Manto do Andarilho', defense: 6, stats: { vida: 20, stamina: 6 }, description: 'Couro curtido com resina de pinheiro; cheira a floresta.' },
      { slot: 'capacete', name: 'Capuz do Andarilho', defense: 3, stats: { mana: 8 }, description: 'Sombra para os olhos e chuva fora do rosto.' },
      { slot: 'botas', name: 'Botas do Andarilho', defense: 2, stats: { velocidade: 4 }, description: 'Solas finas que sentem cada pedra do caminho.' },
      { slot: 'anel', name: 'Anel do Andarilho', defense: 0, stats: { critico: 3 }, description: 'Um anel de cobre com uma folha gravada.' },
    ],
  },
  {
    id: 'sentinela',
    rarity: 'raro',
    level: 12,
    pieces: [
      { slot: 'armadura', name: 'Peitoral do Sentinela', defense: 18, stats: { vida: 55, defesa: 6 }, description: 'Placas de aço sobre cota de malha; pesado, seguro.' },
      { slot: 'capacete', name: 'Elmo do Sentinela', defense: 9, stats: { vida: 20 }, description: 'O elmo ainda tem o brasão da guarda de Aster.' },
      { slot: 'botas', name: 'Grevas do Sentinela', defense: 7, stats: { stamina: 14 }, description: 'Feitas para marchas de três dias sem dormir.' },
      { slot: 'anel', name: 'Selo do Sentinela', defense: 0, stats: { defesa: 8, rouboDeVida: 2 }, description: 'Um sinete que jurou proteger a cidade até o fim.' },
    ],
  },
  {
    id: 'eclipse',
    rarity: 'epico',
    level: 24,
    pieces: [
      { slot: 'armadura', name: 'Vestes do Eclipse', defense: 30, stats: { mana: 60, magia: 18, defesa: 10 }, description: 'Tecido escuro que absorve a luz ao redor.' },
      { slot: 'capacete', name: 'Máscara do Eclipse', defense: 14, stats: { magia: 12, critico: 6 }, description: 'Uma máscara sem rosto, feita de sombra solidificada.' },
      { slot: 'botas', name: 'Passos do Eclipse', defense: 12, stats: { velocidade: 8, furtividade: 10 }, description: 'Quem as usa não deixa pegadas.' },
      { slot: 'anel', name: 'Anel do Eclipse', defense: 0, stats: { magia: 14, rouboDeVida: 4 }, description: 'Um aro de luz negra que gira devagar.' },
    ],
  },
  {
    id: 'aetherion',
    rarity: 'lendario',
    level: 38,
    pieces: [
      { slot: 'armadura', name: 'Égide de Aetherion', defense: 52, stats: { vida: 180, defesa: 24, mana: 60 }, description: 'A última armadura dos guardiões do mundo antigo.' },
      { slot: 'capacete', name: 'Coroa de Aetherion', defense: 24, stats: { magia: 30, vida: 60 }, description: 'Sete pontas, seis ainda brilhantes.' },
      { slot: 'botas', name: 'Sandálias de Aetherion', defense: 20, stats: { velocidade: 12, stamina: 30 }, description: 'Andavam sobre o mar como se fosse pedra.' },
      { slot: 'anel', name: 'Aliança de Aetherion', defense: 0, stats: { ataque: 18, magia: 18, critico: 10 }, description: 'O símbolo do pacto entre as sete entidades.' },
    ],
  },
]

function buildArmor(): ItemDef[] {
  const out: ItemDef[] = []
  for (const set of ARMOR_SETS) {
    for (const piece of set.pieces) {
      const kind: ItemKind = piece.slot === 'anel' ? 'anel' : piece.slot
      out.push({
        id: `${piece.slot}-${set.id}`,
        name: piece.name,
        kind,
        rarity: set.rarity,
        value: Math.round(30 * RARITY_VALUE[set.rarity] ** 1.5),
        description: piece.description,
        stats: { defesa: piece.defense, ...piece.stats },
        level: set.level,
        set: set.id,
        stack: 1,
      })
    }
  }
  return out
}

const EXTRA_EQUIPMENT: ItemDef[] = [
  { id: 'anel-safira', name: 'Anel de Safira', kind: 'anel', rarity: 'raro', value: 220, description: 'Uma pedra azul que pulsa no ritmo da respiração.', stats: { mana: 45, magia: 10 }, level: 10, stack: 1 },
  { id: 'anel-rubi', name: 'Anel de Rubi', kind: 'anel', rarity: 'raro', value: 220, description: 'Quente ao toque, mesmo na neve.', stats: { vida: 80, defesa: 6 }, level: 10, stack: 1 },
  { id: 'anel-cacador', name: 'Anel do Caçador', kind: 'anel', rarity: 'epico', value: 480, description: 'Um olho de falcão gravado no metal.', stats: { critico: 14, velocidade: 6 }, level: 18, stack: 1 },
  { id: 'anel-obsidiana', name: 'Anel de Obsidiana', kind: 'anel', rarity: 'epico', value: 520, description: 'Pedra vulcânica que guarda um fio de fogo.', stats: { magia: 22, ataque: 8 }, level: 20, stack: 1 },
  { id: 'reliquia-coracao', name: 'Coração do Eclipse', kind: 'reliquia', rarity: 'mitico', value: 2400, description: 'Um fragmento do que foi arrancado do mundo. Late como um coração.', stats: { magia: 45, ataque: 30, rouboDeVida: 8, vida: 120 }, level: 30, stack: 1, lore: 'A sétima entidade ainda vive aqui dentro.' },
  { id: 'reliquia-lagrima', name: 'Lágrima da Entidade', kind: 'reliquia', rarity: 'lendario', value: 1600, description: 'Uma gota de luz que nunca seca.', stats: { magia: 30, mana: 100, critico: 8 }, level: 26, stack: 1 },
  { id: 'reliquia-brasao', name: 'Brasão dos Sete', kind: 'reliquia', rarity: 'lendario', value: 1800, description: 'Sete estrelas em bronze; uma está riscada.', stats: { defesa: 30, vida: 200, ataque: 16 }, level: 28, stack: 1 },
  { id: 'reliquia-olho', name: 'Olho do Abismo', kind: 'reliquia', rarity: 'epico', value: 900, description: 'Ele pisca quando você não está olhando.', stats: { critico: 12, magia: 16 }, level: 22, stack: 1 },
  { id: 'reliquia-pena', name: 'Pena de Fênix', kind: 'reliquia', rarity: 'epico', value: 850, description: 'Morna. Se você morrer, ela queima uma vez.', stats: { vida: 150, rouboDeVida: 5 }, level: 20, stack: 1 },
]

const CONSUMABLES: ItemDef[] = [
  { id: 'pocao-vida-1', name: 'Poção de Vida Menor', kind: 'pocao', rarity: 'comum', value: 25, description: 'Gosto de erva amarga, mas fecha cortes.', heal: 45, stack: 20 },
  { id: 'pocao-vida-2', name: 'Poção de Vida', kind: 'pocao', rarity: 'incomum', value: 70, description: 'Um vermelho denso que esquenta a garganta.', heal: 120, stack: 20 },
  { id: 'pocao-vida-3', name: 'Poção de Vida Maior', kind: 'pocao', rarity: 'raro', value: 180, description: 'Destilada em alambique de cristal. Cura quase tudo.', heal: 300, stack: 20 },
  { id: 'pocao-mana-1', name: 'Poção de Mana', kind: 'pocao', rarity: 'incomum', value: 60, description: 'Azul como o céu antes do Eclipse.', manaRestore: 60, stack: 20 },
  { id: 'pocao-stamina', name: 'Elixir de Vigor', kind: 'pocao', rarity: 'incomum', value: 50, description: 'Cheira a menta e trovão.', staminaRestore: 60, stack: 20 },
  { id: 'elixir-eclipse', name: 'Elixir do Eclipse', kind: 'pocao', rarity: 'lendario', value: 400, description: 'Restaura tudo e deixa a marca no braço quente por um instante.', heal: 999, manaRestore: 999, staminaRestore: 999, stack: 5 },
  { id: 'comida-pao', name: 'Pão de Centeio', kind: 'comida', rarity: 'comum', value: 8, description: 'Duro, mas sustenta.', heal: 25, buffSeconds: 60, stack: 20 },
  { id: 'comida-sopa', name: 'Sopa de Legumes', kind: 'comida', rarity: 'comum', value: 14, description: 'O cheiro de uma cozinha de vila.', heal: 55, staminaRestore: 20, buffSeconds: 90, stack: 10 },
  { id: 'comida-peixe', name: 'Peixe Assado', kind: 'comida', rarity: 'incomum', value: 22, description: 'Pescado no lago, assado na fogueira.', heal: 70, buffSeconds: 120, stack: 10 },
  { id: 'comida-carne', name: 'Carne de Caça', kind: 'comida', rarity: 'incomum', value: 30, description: 'Muito tempero para esconder a origem.', heal: 95, staminaRestore: 30, buffSeconds: 150, stack: 10 },
  { id: 'comida-fruta', name: 'Fruta Silvestre', kind: 'comida', rarity: 'comum', value: 6, description: 'Doce, azeda, cheia de sementes.', heal: 20, manaRestore: 15, stack: 20 },
  { id: 'comida-bolo', name: 'Bolo de Mel', kind: 'comida', rarity: 'raro', value: 60, description: 'A receita da avó de alguém em Aster.', heal: 60, manaRestore: 60, buffSeconds: 180, stack: 10 },
]

const MATERIALS: ItemDef[] = [
  { id: 'tool-machado', name: 'Machado de Lenhador', kind: 'material', rarity: 'comum', value: 25, description: 'Ferramenta de trabalho necessária para cortar madeira dos troncos.', stack: 1 },
  { id: 'tool-picareta', name: 'Picareta de Ferro', kind: 'material', rarity: 'comum', value: 30, description: 'Ferramenta de trabalho necessária para extrair minério e pedra.', stack: 1 },
  { id: 'mat-pedra', name: 'Pedra de Construção', kind: 'material', rarity: 'comum', value: 3, description: 'Pedra bruta coletada para construção e forja.', stack: 99 },
  { id: 'mat-ferro', name: 'Minério de Ferro', kind: 'material', rarity: 'comum', value: 8, description: 'A base de quase tudo que é forjado.', stack: 99 },
  { id: 'mat-prata', name: 'Minério de Prata', kind: 'material', rarity: 'incomum', value: 20, description: 'Brilha mesmo no fundo de uma caverna.', stack: 99 },
  { id: 'mat-mithril', name: 'Minério de Mithril', kind: 'material', rarity: 'raro', value: 55, description: 'Leve como madeira, duro como aço.', stack: 99 },
  { id: 'mat-madeira', name: 'Madeira de Freixo', kind: 'material', rarity: 'comum', value: 5, description: 'Flexível, boa para arcos e cabos.', stack: 99 },
  { id: 'mat-fibra', name: 'Fibra Vegetal', kind: 'material', rarity: 'comum', value: 3, description: 'Serve para cordas, tecidos e curativos.', stack: 99 },
  { id: 'mat-erva', name: 'Erva Curativa', kind: 'material', rarity: 'comum', value: 7, description: 'Cresce onde a luz da lua toca o chão.', stack: 99 },
  { id: 'mat-cristal', name: 'Cristal de Gelo', kind: 'material', rarity: 'incomum', value: 26, description: 'Nunca derrete, mesmo perto do fogo.', stack: 99 },
  { id: 'mat-essencia', name: 'Essência de Fogo', kind: 'material', rarity: 'incomum', value: 30, description: 'Uma chama engarrafada que se debate.', stack: 99 },
  { id: 'mat-couro', name: 'Couro Curtido', kind: 'material', rarity: 'comum', value: 9, description: 'Cheira a curtume e a estrada.', stack: 99 },
  { id: 'mat-pena', name: 'Pena de Harpia', kind: 'material', rarity: 'incomum', value: 18, description: 'Ainda corta o vento quando cai.', stack: 99 },
  { id: 'mat-escama', name: 'Escama de Dragão', kind: 'material', rarity: 'raro', value: 80, description: 'Quente, resistente e difícil de arrancar.', stack: 99 },
  { id: 'mat-osso', name: 'Osso Antigo', kind: 'material', rarity: 'incomum', value: 15, description: 'Denso como pedra. De quem?', stack: 99 },
  { id: 'mat-seda', name: 'Seda de Aranha', kind: 'material', rarity: 'incomum', value: 22, description: 'Forte o bastante para segurar um homem.', stack: 99 },
  { id: 'mat-obsidiana', name: 'Obsidiana', kind: 'material', rarity: 'raro', value: 45, description: 'Vidro vulcânico que guarda calor.', stack: 99 },
  { id: 'mat-fragmento', name: 'Fragmento do Eclipse', kind: 'material', rarity: 'lendario', value: 200, description: 'Um pedaço de céu quebrado. Não reflete luz.', stack: 99 },
]

export const ITEMS: ItemDef[] = [...buildWeapons(), ...buildArmor(), ...EXTRA_EQUIPMENT, ...CONSUMABLES, ...MATERIALS]

const BY_ID = new Map(ITEMS.map(item => [item.id, item]))

export function itemById(id: string): ItemDef | undefined {
  return BY_ID.get(id)
}

/** Item ids grouped by kind, used by shops, loot tables and the crafting book. */
export const ITEM_IDS = {
  weapons: ITEMS.filter(i => i.kind === 'arma').map(i => i.id),
  armor: ITEMS.filter(i => i.kind === 'armadura').map(i => i.id),
  helmets: ITEMS.filter(i => i.kind === 'capacete').map(i => i.id),
  boots: ITEMS.filter(i => i.kind === 'botas').map(i => i.id),
  rings: ITEMS.filter(i => i.kind === 'anel').map(i => i.id),
  relics: ITEMS.filter(i => i.kind === 'reliquia').map(i => i.id),
  potions: ITEMS.filter(i => i.kind === 'pocao').map(i => i.id),
  food: ITEMS.filter(i => i.kind === 'comida').map(i => i.id),
  materials: ITEMS.filter(i => i.kind === 'material').map(i => i.id),
}

export const RARITY_LABEL: Record<Rarity, string> = {
  comum: 'Comum',
  incomum: 'Incomum',
  raro: 'Raro',
  epico: 'Épico',
  lendario: 'Lendário',
  mitico: 'Mítico',
}

export const RARITY_COLOR: Record<Rarity, string> = {
  comum: '#c8cbd4',
  incomum: '#67d98b',
  raro: '#5aa9ff',
  epico: '#b978ff',
  lendario: '#ffb347',
  mitico: '#ff5d73',
}
